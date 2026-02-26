import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-utils";

interface DiscoveredRepo {
  path: string;
  name: string;
  branch: string;
  lastCommit: string;
  lastCommitDate: number;
  language: string;
  hasPackageJson: boolean;
  hasReadme: boolean;
  isLinked: boolean;
  linkedProjectId?: string;
}

function detectLanguage(repoPath: string): string {
  const indicators: [string, string][] = [
    ["package.json", "JavaScript/TypeScript"],
    ["Cargo.toml", "Rust"],
    ["go.mod", "Go"],
    ["requirements.txt", "Python"],
    ["pyproject.toml", "Python"],
    ["Gemfile", "Ruby"],
    ["pom.xml", "Java"],
    ["build.gradle", "Java/Kotlin"],
    ["*.csproj", "C#"],
    ["Package.swift", "Swift"],
    ["pubspec.yaml", "Dart/Flutter"],
  ];

  for (const [file, lang] of indicators) {
    if (file.startsWith("*")) {
      try {
        const found = fs.readdirSync(repoPath).some((f) => f.endsWith(file.slice(1)));
        if (found) return lang;
      } catch {
        // skip
      }
    } else {
      if (fs.existsSync(path.join(repoPath, file))) return lang;
    }
  }
  return "Unknown";
}

function scanDirectory(dirPath: string, maxDepth: number = 2): string[] {
  const repos: string[] = [];
  if (!fs.existsSync(dirPath)) return repos;

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

        const full = path.join(dir, entry.name);
        const gitDir = path.join(full, ".git");
        if (fs.existsSync(gitDir)) {
          repos.push(full);
        } else {
          walk(full, depth + 1);
        }
      }
    } catch {
      // Permission denied, skip
    }
  }

  walk(dirPath, 0);
  return repos;
}

function getRepoInfo(repoPath: string): Partial<DiscoveredRepo> | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    let lastCommit = "";
    let lastCommitDate = 0;
    try {
      lastCommit = execSync('git log -1 --format="%s"', {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      const dateStr = execSync('git log -1 --format="%ct"', {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      lastCommitDate = parseInt(dateStr) * 1000;
    } catch {
      // Empty repo
    }

    return {
      branch,
      lastCommit,
      lastCommitDate,
      language: detectLanguage(repoPath),
      hasPackageJson: fs.existsSync(path.join(repoPath, "package.json")),
      hasReadme: fs.existsSync(path.join(repoPath, "README.md")),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customPath = searchParams.get("path");
    const homeDir = os.homedir();

    const scanDirs = customPath
      ? [customPath]
      : [
          path.join(homeDir, "Desktop"),
          path.join(homeDir, "Documents"),
          path.join(homeDir, "Projects"),
          path.join(homeDir, "Developer"),
          path.join(homeDir, "Code"),
          path.join(homeDir, "repos"),
          path.join(homeDir, "workspace"),
          path.join(homeDir, "dev"),
        ];

    const existingProjects = db.select().from(projects).all();
    const linkedPaths = new Map<string, string>();
    for (const p of existingProjects) {
      if (p.localPath) {
        linkedPaths.set(p.localPath, p.id);
      }
    }

    const discoveredRepos: DiscoveredRepo[] = [];

    for (const dir of scanDirs) {
      const repoPaths = scanDirectory(dir);
      for (const repoPath of repoPaths) {
        const info = getRepoInfo(repoPath);
        if (!info) continue;

        const linkedId = linkedPaths.get(repoPath);
        discoveredRepos.push({
          path: repoPath,
          name: path.basename(repoPath),
          branch: info.branch || "main",
          lastCommit: info.lastCommit || "",
          lastCommitDate: info.lastCommitDate || 0,
          language: info.language || "Unknown",
          hasPackageJson: info.hasPackageJson || false,
          hasReadme: info.hasReadme || false,
          isLinked: !!linkedId,
          linkedProjectId: linkedId,
        });
      }
    }

    discoveredRepos.sort((a, b) => {
      if (a.isLinked !== b.isLinked) return a.isLinked ? 1 : -1;
      return b.lastCommitDate - a.lastCommitDate;
    });

    return NextResponse.json({
      repos: discoveredRepos,
      scannedDirs: scanDirs.filter((d) => fs.existsSync(d)),
      total: discoveredRepos.length,
      unlinked: discoveredRepos.filter((r) => !r.isLinked).length,
    });
  } catch (err) {
    console.error("GET discover error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Quick-link a discovered repo to a new project
export async function POST(request: NextRequest) {
  try {
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (!body.repoPath || typeof body.repoPath !== "string") {
      return NextResponse.json({ error: "repoPath is required" }, { status: 400 });
    }

    if (!fs.existsSync(String(body.repoPath))) {
      return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
    }

    const info = getRepoInfo(String(body.repoPath));
    if (!info) {
      return NextResponse.json({ error: "Not a git repository" }, { status: 400 });
    }

    // Read README for description
    let description = "";
    const readmePath = path.join(String(body.repoPath), "README.md");
    if (fs.existsSync(readmePath)) {
      try {
        const content = fs.readFileSync(readmePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("!["));
        description = lines.slice(0, 3).join(" ").slice(0, 200);
      } catch {
        // skip
      }
    }

    // Detect tags from package.json keywords
    let tags: string[] = [];
    if (info.hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(String(body.repoPath), "package.json"), "utf-8"));
        if (pkg.keywords) tags = pkg.keywords.slice(0, 5);
      } catch {
        // skip
      }
    }
    if (info.language && info.language !== "Unknown") {
      tags = [...new Set([info.language.split("/")[0], ...tags])];
    }

    return NextResponse.json({
      name: path.basename(String(body.repoPath)),
      description,
      tags,
      localPath: body.repoPath,
      language: info.language,
      branch: info.branch,
    });
  } catch (err) {
    console.error("POST discover error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
