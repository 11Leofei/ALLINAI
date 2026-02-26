import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, getAIConfig } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { projects, validationItems, notes, dailyCommitments, gitScans } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { safeJsonParse } from "@/lib/api-utils";
import { parseBody } from "@/lib/api-utils";
import fs from "fs";
import path from "path";

function readProjectFiles(localPath: string): string {
  const parts: string[] = [];
  const maxFileSize = 8000;
  const maxTotalSize = 30000;

  const priorityFiles = [
    "README.md",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "requirements.txt",
  ];

  let totalSize = 0;

  for (const file of priorityFiles) {
    const filePath = path.join(localPath, file);
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, "utf-8");
        if (content.length > maxFileSize) {
          content = content.slice(0, maxFileSize) + "\n... (truncated)";
        }
        parts.push(`=== ${file} ===\n${content}`);
        totalSize += content.length;
        if (totalSize > maxTotalSize) break;
      } catch {
        // skip unreadable files
      }
    }
  }

  const srcDir = path.join(localPath, "src");
  if (fs.existsSync(srcDir) && totalSize < maxTotalSize) {
    try {
      const tree = getDirectoryTree(srcDir, 3);
      parts.push(`=== src/ structure ===\n${tree}`);
    } catch {
      // skip
    }
  }

  const entryFiles = [
    "src/index.ts", "src/index.tsx", "src/main.ts", "src/main.tsx",
    "src/app.ts", "src/app.tsx", "src/app/page.tsx", "src/app/layout.tsx",
    "index.ts", "index.js", "main.py", "main.go", "src/main.rs", "src/lib.rs",
  ];

  for (const file of entryFiles) {
    if (totalSize > maxTotalSize) break;
    const filePath = path.join(localPath, file);
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, "utf-8");
        if (content.length > maxFileSize) {
          content = content.slice(0, maxFileSize) + "\n... (truncated)";
        }
        parts.push(`=== ${file} ===\n${content}`);
        totalSize += content.length;
      } catch {
        // skip
      }
    }
  }

  return parts.join("\n\n");
}

function getDirectoryTree(dir: string, maxDepth: number, prefix = "", depth = 0): string {
  if (depth >= maxDepth) return "";
  const lines: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "__pycache__")
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);

    for (const entry of entries) {
      lines.push(`${prefix}${entry.isDirectory() ? "📁" : "📄"} ${entry.name}`);
      if (entry.isDirectory()) {
        const sub = getDirectoryTree(path.join(dir, entry.name), maxDepth, prefix + "  ", depth + 1);
        if (sub) lines.push(sub);
      }
    }
  } catch {
    // permission denied
  }
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const config = getAIConfig();
    if (!config) {
      return NextResponse.json(
        { error: "AI not configured. Please set your API key in Settings." },
        { status: 400 }
      );
    }

    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    const { projectId, analysisType = "full" } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const validation = db
      .select()
      .from(validationItems)
      .where(eq(validationItems.projectId, projectId))
      .all();

    const recentNotes = db
      .select()
      .from(notes)
      .where(eq(notes.projectId, projectId))
      .orderBy(desc(notes.createdAt))
      .limit(5)
      .all();

    const recentCommitments = db
      .select()
      .from(dailyCommitments)
      .where(eq(dailyCommitments.projectId, projectId))
      .orderBy(desc(dailyCommitments.date))
      .limit(10)
      .all();

    const latestScan = db
      .select()
      .from(gitScans)
      .where(eq(gitScans.projectId, projectId))
      .orderBy(desc(gitScans.scannedAt))
      .limit(1)
      .get();

    let codeContext = "";
    if (project.localPath && fs.existsSync(project.localPath)) {
      codeContext = readProjectFiles(project.localPath);
    }

    const tags = safeJsonParse<string[]>(project.tags, []);

    const projectContext = [
      `Project: ${project.name}`,
      `Description: ${project.description || "None"}`,
      `Stage: ${project.stage}`,
      `Priority: ${project.priority}/5`,
      `Momentum: ${project.momentum}/100`,
      `Tags: ${tags.join(", ") || "None"}`,
      `Created: ${new Date(project.createdAt).toISOString().slice(0, 10)}`,
      `Days in current stage: ${Math.floor((Date.now() - project.stageEnteredAt) / (1000 * 60 * 60 * 24))}`,
      "",
      `Validation items (${validation.filter((v) => v.isCompleted).length}/${validation.length} completed):`,
      ...validation.map((v) => `  ${v.isCompleted ? "✅" : "⬜"} ${v.label}`),
      "",
      `Recent notes:`,
      ...recentNotes.map((n) => `  [${new Date(n.createdAt).toISOString().slice(0, 10)}] ${n.content.slice(0, 200)}`),
      "",
      `Recent commitments:`,
      ...recentCommitments.map((c) => `  [${c.date}] ${c.commitment} ${c.isCompleted ? "✅" : "❌"}`),
    ];

    if (latestScan) {
      projectContext.push(
        "",
        `Git activity:`,
        `  Commits (7d): ${latestScan.commits7d}`,
        `  Lines: +${latestScan.linesAdded} / -${latestScan.linesRemoved}`,
        `  Branch: ${latestScan.branch}`,
        `  Summary: ${latestScan.summary}`,
      );
    }

    if (codeContext) {
      projectContext.push("", "=== Project Code ===", codeContext);
    }

    const systemPrompt = getSystemPrompt(String(analysisType));
    const userMessage = projectContext.join("\n");

    const response = await chatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    return NextResponse.json({
      analysis: response.content,
      model: response.model,
      provider: response.provider,
      tokensUsed: response.tokensUsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    console.error("POST ai-analyze error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getSystemPrompt(type: string): string {
  const base = `You are an AI project advisor helping a solo developer/entrepreneur manage their project portfolio. Respond in the same language as the project content (Chinese or English). Be direct, actionable, and honest.`;

  switch (type) {
    case "next-steps":
      return `${base}

Analyze the project and suggest 3-5 specific, actionable next steps. Prioritize by impact. Consider:
- Current stage and what's needed to advance
- Validation gaps
- Momentum trends
- Overdue commitments
Format as a numbered list with brief explanations.`;

    case "risks":
      return `${base}

Identify the top 3-5 risks or blind spots for this project. For each risk:
- What the risk is
- Why it matters
- One concrete mitigation action
Be honest even if it's uncomfortable.`;

    case "code-review":
      return `${base}

Review the project code and provide:
1. Architecture assessment (good patterns vs concerns)
2. Code quality observations
3. 3 specific improvement suggestions
4. Any security or performance red flags
Keep it concise and actionable.`;

    default:
      return `${base}

Provide a comprehensive project health assessment:

1. **Status Summary**: Where the project stands in 2-3 sentences
2. **Strengths**: What's going well (2-3 points)
3. **Concerns**: What needs attention (2-3 points)
4. **Next Steps**: Top 3 recommended actions, ordered by priority
5. **Stage Advice**: Should the project advance to the next stage? Why or why not?

Keep the analysis concise but insightful. Focus on actionable advice.`;
  }
}
