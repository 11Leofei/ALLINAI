import { execSync } from "child_process";
import { db } from "@/lib/db";
import { projects, gitScans, notes, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";
import { t as translate, type Locale } from "@/lib/i18n";

function getLocale(): Locale {
  const row = db.select().from(settings).where(eq(settings.key, "locale")).get();
  return (row ? JSON.parse(row.value) : "zh") as Locale;
}

function tt(key: string, params?: Record<string, string | number>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return translate(key as any, getLocale(), params);
}

interface ScanResult {
  projectId: string;
  projectName: string;
  localPath: string;
  commits7d: number;
  linesAdded: number;
  linesRemoved: number;
  lastCommitAt: number | null;
  branch: string;
  todoCount: number;
  hasTests: boolean;
  hasCiCd: boolean;
  summary: string;
  momentumDelta: number;
}

function runGit(cwd: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function scanProject(projectId: string, projectName: string, localPath: string): ScanResult | null {
  // Validate path exists and is a git repo
  if (!fs.existsSync(localPath)) return null;
  const gitDir = path.join(localPath, ".git");
  if (!fs.existsSync(gitDir)) return null;

  // Current branch
  const branch = runGit(localPath, "rev-parse --abbrev-ref HEAD") || "unknown";

  // Commits in last 7 days
  const commitLog = runGit(localPath, 'log --oneline --since="7 days ago" --no-merges');
  const commits7d = commitLog ? commitLog.split("\n").filter(Boolean).length : 0;

  // Lines added/removed in last 7 days
  let linesAdded = 0;
  let linesRemoved = 0;
  const diffStat = runGit(localPath, 'diff --stat --shortstat HEAD~' + Math.min(commits7d || 1, 50) + '..HEAD 2>/dev/null');
  if (diffStat) {
    const addMatch = diffStat.match(/(\d+) insertion/);
    const delMatch = diffStat.match(/(\d+) deletion/);
    if (addMatch) linesAdded = parseInt(addMatch[1]);
    if (delMatch) linesRemoved = parseInt(delMatch[1]);
  }

  // Fallback: use diffstat from last 7 days of commits
  if (linesAdded === 0 && linesRemoved === 0 && commits7d > 0) {
    const weekDiff = runGit(localPath, 'log --since="7 days ago" --no-merges --numstat --pretty=""');
    if (weekDiff) {
      for (const line of weekDiff.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const a = parseInt(parts[0]);
          const d = parseInt(parts[1]);
          if (!isNaN(a)) linesAdded += a;
          if (!isNaN(d)) linesRemoved += d;
        }
      }
    }
  }

  // Last commit timestamp
  let lastCommitAt: number | null = null;
  const lastCommitDate = runGit(localPath, "log -1 --format=%ct");
  if (lastCommitDate) {
    lastCommitAt = parseInt(lastCommitDate) * 1000; // to ms
  }

  // Count TODOs/FIXMEs
  let todoCount = 0;
  try {
    const todoOutput = execSync(
      'grep -r "TODO\\|FIXME\\|HACK\\|XXX" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" -c 2>/dev/null || true',
      { cwd: localPath, encoding: "utf-8", timeout: 10000 }
    );
    for (const line of todoOutput.split("\n")) {
      const match = line.match(/:(\d+)$/);
      if (match) todoCount += parseInt(match[1]);
    }
  } catch { /* ignore */ }

  // Check for tests
  const hasTests =
    fs.existsSync(path.join(localPath, "__tests__")) ||
    fs.existsSync(path.join(localPath, "tests")) ||
    fs.existsSync(path.join(localPath, "test")) ||
    fs.existsSync(path.join(localPath, "spec")) ||
    fs.existsSync(path.join(localPath, "vitest.config.ts")) ||
    fs.existsSync(path.join(localPath, "jest.config.ts")) ||
    fs.existsSync(path.join(localPath, "jest.config.js"));

  // Check for CI/CD
  const hasCiCd =
    fs.existsSync(path.join(localPath, ".github", "workflows")) ||
    fs.existsSync(path.join(localPath, ".gitlab-ci.yml")) ||
    fs.existsSync(path.join(localPath, "Dockerfile")) ||
    fs.existsSync(path.join(localPath, "vercel.json")) ||
    fs.existsSync(path.join(localPath, "netlify.toml"));

  // Calculate momentum delta based on real activity
  let momentumDelta = 0;
  if (commits7d >= 10) momentumDelta = 20;
  else if (commits7d >= 5) momentumDelta = 12;
  else if (commits7d >= 2) momentumDelta = 6;
  else if (commits7d >= 1) momentumDelta = 3;
  else {
    // No commits in 7 days = decay
    const daysSinceCommit = lastCommitAt
      ? Math.floor((Date.now() - lastCommitAt) / (1000 * 60 * 60 * 24))
      : 30;
    if (daysSinceCommit > 14) momentumDelta = -15;
    else if (daysSinceCommit > 7) momentumDelta = -8;
  }

  // Generate summary (locale-aware)
  const parts: string[] = [];
  if (commits7d > 0) {
    parts.push(tt("gitScan.commits", { count: commits7d, added: linesAdded, removed: linesRemoved }));
  } else {
    const days = lastCommitAt
      ? Math.floor((Date.now() - lastCommitAt) / (1000 * 60 * 60 * 24))
      : -1;
    parts.push(days >= 0 ? tt("gitScan.noCommits", { days }) : tt("gitScan.noCommitsEver"));
  }
  parts.push(tt("gitScan.branchName", { name: branch }));
  if (todoCount > 0) parts.push(tt("gitScan.todoCount", { count: todoCount }));
  if (!hasTests) parts.push(tt("gitScan.noTests"));
  if (hasCiCd) parts.push(tt("gitScan.hasCiCd"));

  return {
    projectId,
    projectName,
    localPath,
    commits7d,
    linesAdded,
    linesRemoved,
    lastCommitAt,
    branch,
    todoCount,
    hasTests,
    hasCiCd,
    summary: parts.join(" | "),
    momentumDelta,
  };
}

export async function scanAllProjects(): Promise<ScanResult[]> {
  const allProjects = db.select().from(projects).all();
  const withPath = allProjects.filter((p) => p.localPath && p.stage !== "archived");

  const results: ScanResult[] = [];

  for (const project of withPath) {
    const result = scanProject(project.id, project.name, project.localPath!);
    if (!result) continue;

    results.push(result);

    // Save scan record
    db.insert(gitScans)
      .values({
        id: nanoid(),
        projectId: project.id,
        scannedAt: Date.now(),
        commits7d: result.commits7d,
        linesAdded: result.linesAdded,
        linesRemoved: result.linesRemoved,
        lastCommitAt: result.lastCommitAt,
        branch: result.branch,
        summary: result.summary,
      })
      .run();

    // Update project momentum based on real git activity
    if (result.momentumDelta !== 0) {
      const current = project.momentum;
      const newMomentum = Math.max(0, Math.min(100, current + result.momentumDelta));
      db.update(projects)
        .set({
          momentum: newMomentum,
          updatedAt: Date.now(),
        })
        .where(eq(projects.id, project.id))
        .run();
    }

    // Add auto-generated note
    db.insert(notes)
      .values({
        id: nanoid(),
        projectId: project.id,
        content: tt("gitScan.autoNote", { summary: result.summary }),
        createdAt: Date.now(),
      })
      .run();
  }

  return results;
}

export async function scanSingleProject(projectId: string): Promise<ScanResult | null> {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project?.localPath) return null;

  const result = scanProject(project.id, project.name, project.localPath);
  if (!result) return null;

  // Save scan record
  db.insert(gitScans)
    .values({
      id: nanoid(),
      projectId: project.id,
      scannedAt: Date.now(),
      commits7d: result.commits7d,
      linesAdded: result.linesAdded,
      linesRemoved: result.linesRemoved,
      lastCommitAt: result.lastCommitAt,
      branch: result.branch,
      summary: result.summary,
    })
    .run();

  // Update momentum
  if (result.momentumDelta !== 0) {
    const newMomentum = Math.max(0, Math.min(100, project.momentum + result.momentumDelta));
    db.update(projects)
      .set({ momentum: newMomentum, updatedAt: Date.now() })
      .where(eq(projects.id, project.id))
      .run();
  }

  // Add auto note
  db.insert(notes)
    .values({
      id: nanoid(),
      projectId: project.id,
      content: tt("gitScan.autoNote", { summary: result.summary }),
      createdAt: Date.now(),
    })
    .run();

  return result;
}
