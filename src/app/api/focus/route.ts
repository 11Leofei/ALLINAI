import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, dailyCommitments, validationItems, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJsonParse } from "@/lib/api-utils";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSetting(key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  return safeJsonParse(row.value, row.value);
}

interface ScoredProject {
  id: string;
  name: string;
  stage: string;
  priority: number;
  momentum: number;
  score: number;
  reasons: string[];
  daysInStage: number;
  pendingCommitments: number;
  validationProgress: number;
}

// GET: recommend what to work on RIGHT NOW
export async function GET() {
  try {
    const now = Date.now();
    const today = getToday();

    const allProjects = db.select().from(projects).all();
    const activeProjects = allProjects.filter((p) => p.stage !== "archived");

    if (activeProjects.length === 0) {
      return NextResponse.json({
        focus: null,
        message: "no_projects",
        alternatives: [],
      });
    }

    // Get today's commitments
    const todayCommitments = db
      .select()
      .from(dailyCommitments)
      .where(eq(dailyCommitments.date, today))
      .all();

    // Get pending (incomplete) commitments per project
    const pendingByProject: Record<string, number> = {};
    for (const c of todayCommitments) {
      if (!c.isCompleted) {
        pendingByProject[c.projectId] = (pendingByProject[c.projectId] || 0) + 1;
      }
    }

    // Get staleness thresholds
    const thresholds = (getSetting("nudge.staleThresholdDays") as Record<string, number>) || {
      idea: 3, development: 5, launch: 7, validation: 5, data_collection: 7,
    };

    // Get all validation items for progress
    const allValidation = db.select().from(validationItems).all();
    const validationByProject: Record<string, { total: number; done: number }> = {};
    for (const v of allValidation) {
      if (!validationByProject[v.projectId]) {
        validationByProject[v.projectId] = { total: 0, done: 0 };
      }
      validationByProject[v.projectId].total++;
      if (v.isCompleted) validationByProject[v.projectId].done++;
    }

    // Check for overdue commitments from previous days
    const allCommitments = db.select().from(dailyCommitments).all();
    const overdueByProject: Record<string, number> = {};
    for (const c of allCommitments) {
      if (!c.isCompleted && c.date < today) {
        overdueByProject[c.projectId] = (overdueByProject[c.projectId] || 0) + 1;
      }
    }

    // Score each project
    const scored: ScoredProject[] = activeProjects.map((p) => {
      let score = 0;
      const reasons: string[] = [];
      const daysInStage = Math.floor((now - p.stageEnteredAt) / (1000 * 60 * 60 * 24));
      const threshold = thresholds[p.stage] || 5;
      const pending = pendingByProject[p.id] || 0;
      const overdue = overdueByProject[p.id] || 0;
      const vp = validationByProject[p.id];
      const validationProgress = vp ? Math.round((vp.done / vp.total) * 100) : 0;

      // Priority weight (5=highest → more weight)
      score += p.priority * 8;
      if (p.priority >= 4) reasons.push("高优先级");

      // Staleness: the more stale, the higher the urgency
      if (daysInStage >= threshold) {
        const overdueDays = daysInStage - threshold;
        score += 20 + overdueDays * 5;
        reasons.push(`停滞 ${daysInStage} 天`);
      }

      // Pending commitments today → you already promised to work on this
      if (pending > 0) {
        score += 30 + pending * 10;
        reasons.push(`今日 ${pending} 个未完成承诺`);
      }

      // Overdue commitments from previous days
      if (overdue > 0) {
        score += 25 + overdue * 8;
        reasons.push(`${overdue} 个拖延承诺`);
      }

      // Low momentum = needs help
      if (p.momentum < 30) {
        score += 15;
        reasons.push("动量极低");
      } else if (p.momentum < 50) {
        score += 8;
        reasons.push("动量偏低");
      }

      // Validation progress close to completion → push to finish
      if (vp && vp.total > 0 && validationProgress >= 70 && validationProgress < 100) {
        score += 12;
        reasons.push(`验证进度 ${validationProgress}%，快完成了`);
      }

      // Recently updated projects get a small penalty (they're already getting attention)
      const daysSinceUpdate = Math.floor((now - p.updatedAt) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate === 0) {
        score -= 5; // Already touched today
      }

      return {
        id: p.id,
        name: p.name,
        stage: p.stage,
        priority: p.priority,
        momentum: p.momentum,
        score: Math.max(0, score),
        reasons,
        daysInStage,
        pendingCommitments: pending + overdue,
        validationProgress,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const focus = scored[0] || null;
    const alternatives = scored.slice(1, 4);

    return NextResponse.json({
      focus,
      alternatives,
      message: focus
        ? focus.score >= 50
          ? "urgent"
          : focus.score >= 25
          ? "suggested"
          : "optional"
        : "no_projects",
    });
  } catch (err) {
    console.error("GET focus error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
