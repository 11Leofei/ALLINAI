import { db } from "@/lib/db";
import { projects, nudges, settings, validationItems } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { updateAllMomentum } from "./momentum";
import { t as translate, type Locale } from "@/lib/i18n";
import { type ProjectStage } from "@/types";

function getSetting(key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? JSON.parse(row.value) : null;
}

function getLocale(): Locale {
  const row = db.select().from(settings).where(eq(settings.key, "locale")).get();
  return (row ? JSON.parse(row.value) : "zh") as Locale;
}

function tt(key: string, params?: Record<string, string | number>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return translate(key as any, getLocale(), params);
}

function stageLabel(stage: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return translate(`stage.${stage}` as any, getLocale());
}

function wasNudgeSentRecently(
  projectId: string | null,
  type: string,
  withinMs: number
): boolean {
  const since = Date.now() - withinMs;
  const existing = db
    .select()
    .from(nudges)
    .where(
      and(
        projectId
          ? eq(nudges.projectId, projectId)
          : eq(nudges.projectId, ""),
        eq(nudges.type, type),
        gte(nudges.sentAt, since)
      )
    )
    .get();
  return !!existing;
}

function recordNudge(
  projectId: string | null,
  message: string,
  type: string
): void {
  db.insert(nudges)
    .values({
      id: nanoid(),
      projectId,
      message,
      type,
      sentAt: Date.now(),
      dismissed: 0,
    })
    .run();
}

export interface NudgeResult {
  projectId: string | null;
  message: string;
  type: string;
}

export function checkNudges(): NudgeResult[] {
  const enabled = getSetting("nudge.enabled") as boolean;
  if (!enabled) return [];

  const results: NudgeResult[] = [];
  const checkIntervalMs =
    ((getSetting("nudge.checkIntervalMinutes") as number) || 30) * 60 * 1000;
  const thresholds =
    (getSetting("nudge.staleThresholdDays") as Record<string, number>) || {};

  // Update all momentum scores first
  updateAllMomentum();

  const allProjects = db.select().from(projects).all();

  let staleCount = 0;
  let lowMomentumCount = 0;

  for (const project of allProjects) {
    if (project.stage === "archived") continue;

    // Staleness check
    const threshold = thresholds[project.stage] || 5;
    const daysSinceStageEntry =
      (Date.now() - project.stageEnteredAt) / (1000 * 60 * 60 * 24);

    if (daysSinceStageEntry >= threshold) {
      staleCount++;
      if (!wasNudgeSentRecently(project.id, "stale", checkIntervalMs)) {
        const days = Math.floor(daysSinceStageEntry);
        const message = tt("nudge.stale", {
          name: project.name,
          stage: stageLabel(project.stage),
          days,
        });
        recordNudge(project.id, message, "stale");
        results.push({ projectId: project.id, message, type: "stale" });
      }
    }

    // Momentum drop check
    if (project.momentum < 30) {
      lowMomentumCount++;
      if (
        !wasNudgeSentRecently(project.id, "momentum_drop", checkIntervalMs)
      ) {
        const message = tt("nudge.momentumDrop", {
          name: project.name,
          momentum: Math.round(project.momentum),
        });
        recordNudge(project.id, message, "momentum_drop");
        results.push({
          projectId: project.id,
          message,
          type: "momentum_drop",
        });
      }
    }

    // Milestone check: validation progress crosses 50% or 75%
    const items = db
      .select()
      .from(validationItems)
      .where(eq(validationItems.projectId, project.id))
      .all();
    if (items.length >= 2) {
      const completed = items.filter((v) => v.isCompleted).length;
      const percent = Math.round((completed / items.length) * 100);

      if (percent >= 50 && percent < 100) {
        if (
          !wasNudgeSentRecently(project.id, "milestone", 24 * 60 * 60 * 1000)
        ) {
          const message = tt("nudge.milestone", {
            name: project.name,
            percent,
          });
          recordNudge(project.id, message, "milestone");
          results.push({
            projectId: project.id,
            message,
            type: "milestone",
          });
        }
      }
    }
  }

  // Daily digest nudge (once per day)
  if (
    (staleCount > 0 || lowMomentumCount > 0) &&
    !wasNudgeSentRecently(null, "daily_digest", 20 * 60 * 60 * 1000)
  ) {
    const message = tt("nudge.dailyDigest", {
      stale: staleCount,
      low: lowMomentumCount,
    });
    recordNudge(null, message, "daily_digest");
    results.push({ projectId: null, message, type: "daily_digest" });
  }

  return results;
}
