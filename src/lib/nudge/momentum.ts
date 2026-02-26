import { db } from "@/lib/db";
import {
  projects,
  stageTransitions,
  validationItems,
  dailyCommitments,
  gitScans,
  settings,
} from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

function getSetting(key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? JSON.parse(row.value) : null;
}

/**
 * Honest momentum formula.
 *
 * Only real work counts:
 * 1. Git activity (commits) — the most honest signal
 * 2. Validation completion rate — proximity to real milestones
 * 3. Commitment fulfillment — did you do what you said you'd do?
 * 4. Stage advancement — actual forward movement
 * 5. Time decay — inactivity costs you
 *
 * Writing notes does NOT count. Using the tool is NOT working on the project.
 */
export function calculateMomentum(projectId: string): number {
  const decayRate = (getSetting("momentum.decayRatePerDay") as number) ?? 5;

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) return 0;

  const now = Date.now();
  const daysSinceUpdate = (now - project.updatedAt) / (1000 * 60 * 60 * 24);

  // === 1. Git activity (0-35 pts) ===
  // The most honest signal — did you write code?
  const recentScan = db
    .select()
    .from(gitScans)
    .where(eq(gitScans.projectId, projectId))
    .all()
    .sort((a, b) => b.scannedAt - a.scannedAt)[0];

  let gitScore = 0;
  if (recentScan) {
    const commits = recentScan.commits7d || 0;
    if (commits >= 10) gitScore = 35;
    else if (commits >= 5) gitScore = 25;
    else if (commits >= 2) gitScore = 15;
    else if (commits >= 1) gitScore = 8;
  }

  // === 2. Validation completion (0-25 pts) ===
  // How close are you to real milestones?
  const allValidation = db
    .select()
    .from(validationItems)
    .where(eq(validationItems.projectId, projectId))
    .all();

  let validationScore = 0;
  if (allValidation.length > 0) {
    const completedCount = allValidation.filter((v) => v.isCompleted).length;
    const ratio = completedCount / allValidation.length;
    validationScore = Math.round(ratio * 25);
  }

  // === 3. Commitment fulfillment (0-20 pts) ===
  // Did you do what you said you'd do in the last 7 days?
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgoStr = new Date(sevenDaysAgo).toISOString().slice(0, 10);
  const recentCommitments = db
    .select()
    .from(dailyCommitments)
    .where(
      and(
        eq(dailyCommitments.projectId, projectId),
        gte(dailyCommitments.date, sevenDaysAgoStr)
      )
    )
    .all();

  let commitmentScore = 0;
  if (recentCommitments.length > 0) {
    const fulfilled = recentCommitments.filter((c) => c.isCompleted).length;
    const ratio = fulfilled / recentCommitments.length;
    commitmentScore = Math.round(ratio * 20);
  }

  // === 4. Stage advancement (0-20 pts) ===
  // Did you actually move forward?
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

  const stageScore = Math.min(recentTransitions.length * 20, 20);

  // === Time decay ===
  // Inactivity costs you. No activity for 10+ days = near zero.
  const decay = daysSinceUpdate * decayRate;

  const rawScore = gitScore + validationScore + commitmentScore + stageScore - decay;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
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
