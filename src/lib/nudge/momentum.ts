import { db } from "@/lib/db";
import { projects, stageTransitions, validationItems, notes, metrics, settings } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

function getSetting(key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? JSON.parse(row.value) : null;
}

export function calculateMomentum(projectId: string): number {
  const decayRate = (getSetting("momentum.decayRatePerDay") as number) ?? 5;
  const updateBoost = (getSetting("momentum.updateBoost") as number) ?? 10;
  const stageAdvanceBoost =
    (getSetting("momentum.stageAdvanceBoost") as number) ?? 25;

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) return 0;

  const now = Date.now();
  const daysSinceUpdate = (now - project.updatedAt) / (1000 * 60 * 60 * 24);

  // Count stage advances in last 30 days
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentTransitions = db
    .select()
    .from(stageTransitions)
    .where(
      and(
        eq(stageTransitions.projectId, projectId),
        gte(stageTransitions.transitionedAt, thirtyDaysAgo)
      )
    )
    .all();

  // Count distinct days with activity in last 7 days
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const activeDays = new Set<string>();

  const recentNotes = db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.projectId, projectId),
        gte(notes.createdAt, sevenDaysAgo)
      )
    )
    .all();
  for (const n of recentNotes) {
    activeDays.add(new Date(n.createdAt).toISOString().slice(0, 10));
  }

  const recentMetrics = db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.projectId, projectId),
        gte(metrics.recordedAt, sevenDaysAgo)
      )
    )
    .all();
  for (const m of recentMetrics) {
    activeDays.add(new Date(m.recordedAt).toISOString().slice(0, 10));
  }

  const recentValidations = db
    .select()
    .from(validationItems)
    .where(
      and(
        eq(validationItems.projectId, projectId),
        gte(validationItems.completedAt, sevenDaysAgo)
      )
    )
    .all();
  for (const v of recentValidations) {
    if (v.completedAt) {
      activeDays.add(new Date(v.completedAt).toISOString().slice(0, 10));
    }
  }

  if (project.updatedAt >= sevenDaysAgo) {
    activeDays.add(new Date(project.updatedAt).toISOString().slice(0, 10));
  }

  // Validation progress bonus (0-15 pts)
  const allValidation = db
    .select()
    .from(validationItems)
    .where(eq(validationItems.projectId, projectId))
    .all();
  let validationBonus = 0;
  if (allValidation.length > 0) {
    const completedCount = allValidation.filter((v) => v.isCompleted).length;
    validationBonus = Math.round((completedCount / allValidation.length) * 15);
  }

  // Active days bonus: each active day in last 7 gives updateBoost points (capped at 3 days)
  const activityBonus = Math.min(activeDays.size, 3) * updateBoost;

  const score =
    100 -
    daysSinceUpdate * decayRate +
    recentTransitions.length * stageAdvanceBoost +
    activityBonus +
    validationBonus;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function updateProjectMomentum(projectId: string): number {
  const momentum = calculateMomentum(projectId);
  db.update(projects)
    .set({ momentum })
    .where(eq(projects.id, projectId))
    .run();
  return momentum;
}

export function updateAllMomentum(): void {
  const allProjects = db.select().from(projects).all();
  for (const project of allProjects) {
    if (project.stage !== "archived") {
      updateProjectMomentum(project.id);
    }
  }
}
