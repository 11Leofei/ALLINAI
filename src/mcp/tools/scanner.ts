import { z } from "zod";
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const { projects, metrics, notes } = schema;

export const scanLocalProjectSchema = z.object({
  projectId: z.string().describe("ALLINAI project ID to associate results with"),
  localPath: z.string().describe("Absolute path to local project directory"),
});

function execSafe(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, timeout: 10000, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function scanLocalProject(args: z.infer<typeof scanLocalProjectSchema>) {
  const { projectId, localPath } = args;

  // Verify project exists
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return { error: "Project not found in ALLINAI" };
  if (!existsSync(localPath)) return { error: `Path does not exist: ${localPath}` };

  const now = Date.now();
  const results: Record<string, unknown> = { projectId, localPath, scannedAt: new Date().toISOString() };

  // Update localPath on project
  db.update(projects).set({ localPath, updatedAt: now }).where(eq(projects.id, projectId)).run();

  // 1. Git activity
  const isGitRepo = existsSync(path.join(localPath, ".git"));
  results.isGitRepo = isGitRepo;

  if (isGitRepo) {
    // Recent commits (7 days)
    const commitCount7d = execSafe("git log --oneline --since='7 days ago' | wc -l", localPath);
    const commitCount30d = execSafe("git log --oneline --since='30 days ago' | wc -l", localPath);
    const lastCommitDate = execSafe("git log -1 --format=%ci", localPath);
    const currentBranch = execSafe("git branch --show-current", localPath);
    const branchCount = execSafe("git branch | wc -l", localPath);

    results.git = {
      commitsLast7Days: parseInt(commitCount7d) || 0,
      commitsLast30Days: parseInt(commitCount30d) || 0,
      lastCommitDate,
      currentBranch,
      branchCount: parseInt(branchCount) || 0,
    };

    // Code changes (last 7 days)
    const diffStat = execSafe("git diff --shortstat HEAD~10 HEAD 2>/dev/null || echo ''", localPath);
    results.codeDiff = diffStat;

    // Record metrics
    const commits7d = parseInt(commitCount7d) || 0;
    db.insert(metrics).values({
      id: nanoid(), projectId, name: "commits_7d", value: commits7d, recordedAt: now,
    }).run();

    // Update momentum based on git activity
    let momentumBoost = 0;
    if (commits7d > 10) momentumBoost = 30;
    else if (commits7d > 5) momentumBoost = 20;
    else if (commits7d > 0) momentumBoost = 10;

    const newMomentum = Math.min(100, Math.max(0, (project.momentum || 50) + momentumBoost - 5));
    db.update(projects).set({ momentum: newMomentum, updatedAt: now }).where(eq(projects.id, projectId)).run();
    results.momentumUpdated = newMomentum;
  }

  // 2. TODO/FIXME scan
  const todoCount = execSafe(
    "grep -r --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.py' -c 'TODO\\|FIXME' . 2>/dev/null | awk -F: '{sum+=$2} END {print sum}'",
    localPath
  );
  results.todoCount = parseInt(todoCount) || 0;

  // 3. README check
  const hasReadme = existsSync(path.join(localPath, "README.md"));
  let readmeLength = 0;
  if (hasReadme) {
    readmeLength = readFileSync(path.join(localPath, "README.md"), "utf-8").length;
  }
  results.readme = { exists: hasReadme, length: readmeLength };

  // 4. Dependency check
  const hasPackageJson = existsSync(path.join(localPath, "package.json"));
  const hasRequirementsTxt = existsSync(path.join(localPath, "requirements.txt"));
  const hasCargoToml = existsSync(path.join(localPath, "Cargo.toml"));
  const hasGoMod = existsSync(path.join(localPath, "go.mod"));
  results.dependencies = {
    packageJson: hasPackageJson,
    requirementsTxt: hasRequirementsTxt,
    cargoToml: hasCargoToml,
    goMod: hasGoMod,
  };

  // 5. Test coverage check
  const hasTestDir = existsSync(path.join(localPath, "tests")) ||
    existsSync(path.join(localPath, "__tests__")) ||
    existsSync(path.join(localPath, "test"));
  const testFileCount = execSafe(
    "find . -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' | wc -l",
    localPath
  );
  results.testing = {
    hasTestDirectory: hasTestDir,
    testFileCount: parseInt(testFileCount) || 0,
  };

  // 6. Deployment config
  const hasDockerfile = existsSync(path.join(localPath, "Dockerfile"));
  const hasGithubActions = existsSync(path.join(localPath, ".github", "workflows"));
  const hasVercelConfig = existsSync(path.join(localPath, "vercel.json"));
  const hasNetlifyConfig = existsSync(path.join(localPath, "netlify.toml"));
  results.deployment = {
    dockerfile: hasDockerfile,
    githubActions: hasGithubActions,
    vercel: hasVercelConfig,
    netlify: hasNetlifyConfig,
  };

  // 7. Stage suggestion
  const git = results.git as { commitsLast7Days: number; branchCount: number } | undefined;
  const deployment = results.deployment as { dockerfile: boolean; githubActions: boolean; vercel: boolean; netlify: boolean };
  const testing = results.testing as { hasTestDirectory: boolean; testFileCount: number };

  let suggestedStage = project.stage;
  if (deployment.dockerfile || deployment.githubActions || deployment.vercel || deployment.netlify) {
    if (project.stage === "development") suggestedStage = "launch";
  } else if (git && git.commitsLast7Days > 0 && project.stage === "idea") {
    suggestedStage = "development";
  }
  results.suggestedStage = suggestedStage;
  results.stageSuggestionChanged = suggestedStage !== project.stage;

  // Add scan note
  const noteLines: string[] = [`Local project scan: ${localPath}`];
  if (isGitRepo && git) {
    noteLines.push(`Git: ${git.commitsLast7Days} commits in 7 days, branch: ${(results.git as { currentBranch: string }).currentBranch}`);
  }
  noteLines.push(`TODOs: ${results.todoCount}, README: ${hasReadme ? `${readmeLength} chars` : "missing"}`);
  noteLines.push(`Tests: ${testing.testFileCount} files, Deploy: ${[
    deployment.dockerfile && "Docker",
    deployment.githubActions && "GitHub Actions",
    deployment.vercel && "Vercel",
    deployment.netlify && "Netlify",
  ].filter(Boolean).join(", ") || "none"}`);

  if (results.stageSuggestionChanged) {
    noteLines.push(`Suggested stage change: ${project.stage} → ${suggestedStage}`);
  }

  db.insert(notes).values({
    id: nanoid(),
    projectId,
    content: noteLines.join("\n"),
    createdAt: now,
  }).run();

  return results;
}
