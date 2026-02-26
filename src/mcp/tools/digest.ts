import { z } from "zod";
import { db, schema } from "../db";
import { desc, eq } from "drizzle-orm";

const { projects, settings } = schema;

export const getDigestSchema = z.object({});

export function getDigest() {
  const allProjects = db.select().from(projects).orderBy(desc(projects.updatedAt)).all()
    .map((p) => ({ ...p, tags: JSON.parse(p.tags) as string[] }));

  const activeProjects = allProjects.filter((p) => p.stage !== "archived");

  // Get stale thresholds from settings
  const thresholdSetting = db.select().from(settings).where(eq(settings.key, "nudge.staleThresholdDays")).get();
  const thresholds: Record<string, number> = thresholdSetting
    ? JSON.parse(thresholdSetting.value)
    : { idea: 3, development: 5, launch: 7, validation: 5, data_collection: 7 };

  const staleProjects = activeProjects
    .filter((p) => {
      const threshold = thresholds[p.stage] || 5;
      const days = (Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24);
      return days >= threshold;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      daysSinceStageEntry: Math.floor((Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24)),
      momentum: p.momentum,
    }))
    .sort((a, b) => b.daysSinceStageEntry - a.daysSinceStageEntry);

  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const recentWins = activeProjects
    .filter((p) => p.updatedAt >= twoDaysAgo)
    .map((p) => ({ id: p.id, name: p.name, stage: p.stage, momentum: p.momentum }));

  const globalMomentum = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((sum, p) => sum + p.momentum, 0) / activeProjects.length)
    : 0;

  const momentumRanking = [...activeProjects]
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name, momentum: Math.round(p.momentum), stage: p.stage }));

  return {
    date: new Date().toISOString().split("T")[0],
    globalMomentum,
    activeProjectCount: activeProjects.length,
    totalProjectCount: allProjects.length,
    staleProjects,
    recentWins,
    momentumRanking,
    actionSuggestion: staleProjects.length > 0
      ? `Focus on "${staleProjects[0].name}" — stale in ${staleProjects[0].stage} for ${staleProjects[0].daysSinceStageEntry} days.`
      : activeProjects.length > 0
      ? "All projects on track. Keep the momentum!"
      : "No active projects. Create one to get started!",
  };
}

export const getSettingsSchema = z.object({});

export function getSettings() {
  const allSettings = db.select().from(settings).all();
  const result: Record<string, unknown> = {};
  for (const s of allSettings) {
    result[s.key] = JSON.parse(s.value);
  }
  return result;
}
