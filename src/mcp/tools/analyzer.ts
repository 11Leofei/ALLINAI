import { z } from "zod";
import { db, schema } from "../db";
import { eq, desc, asc } from "drizzle-orm";

const { projects, validationItems, metrics, notes, stageTransitions } = schema;

export const analyzeProjectSchema = z.object({
  projectId: z.string().describe("Project ID to analyze"),
});

const STAGE_ORDER = ["idea", "development", "launch", "validation", "data_collection"];

export function analyzeProject(args: z.infer<typeof analyzeProjectSchema>) {
  const project = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  if (!project) return { error: "Project not found" };

  const validation = db.select().from(validationItems)
    .where(eq(validationItems.projectId, args.projectId))
    .orderBy(asc(validationItems.sortOrder)).all();

  const allMetrics = db.select().from(metrics)
    .where(eq(metrics.projectId, args.projectId))
    .orderBy(desc(metrics.recordedAt)).all();

  const allNotes = db.select().from(notes)
    .where(eq(notes.projectId, args.projectId))
    .orderBy(desc(notes.createdAt)).all();

  const transitions = db.select().from(stageTransitions)
    .where(eq(stageTransitions.projectId, args.projectId))
    .orderBy(desc(stageTransitions.transitionedAt)).all();

  // Analysis
  const completedValidation = validation.filter((v) => v.isCompleted).length;
  const totalValidation = validation.length;
  const validationRate = totalValidation > 0 ? completedValidation / totalValidation : 0;

  const daysSinceCreation = Math.floor((Date.now() - project.createdAt) / (1000 * 60 * 60 * 24));
  const daysSinceUpdate = Math.floor((Date.now() - project.updatedAt) / (1000 * 60 * 60 * 24));
  const daysSinceStageEntry = Math.floor((Date.now() - project.stageEnteredAt) / (1000 * 60 * 60 * 24));

  // Momentum trend (compare recent metrics)
  const recentMetrics = allMetrics.filter((m) => m.name === "commits_7d").slice(0, 3);
  let momentumTrend = "stable";
  if (recentMetrics.length >= 2) {
    if (recentMetrics[0].value > recentMetrics[1].value) momentumTrend = "rising";
    else if (recentMetrics[0].value < recentMetrics[1].value) momentumTrend = "declining";
  }

  // Blockers identification
  const blockers: string[] = [];
  const incompleteValidation = validation.filter((v) => !v.isCompleted);
  if (incompleteValidation.length > 0) {
    blockers.push(`${incompleteValidation.length} incomplete validation items`);
  }
  if (daysSinceUpdate > 3) {
    blockers.push(`No updates for ${daysSinceUpdate} days`);
  }
  if (project.momentum < 30) {
    blockers.push(`Low momentum (${Math.round(project.momentum)})`);
  }

  // Stage assessment
  const currentStageIdx = STAGE_ORDER.indexOf(project.stage);
  let stageAssessment = `Project is in ${project.stage} stage`;

  if (validationRate >= 0.8 && currentStageIdx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[currentStageIdx + 1];
    stageAssessment = `Validation is ${Math.round(validationRate * 100)}% complete. Consider advancing to ${nextStage}.`;
  } else if (daysSinceStageEntry > 14) {
    stageAssessment = `Project has been in ${project.stage} for ${daysSinceStageEntry} days. Evaluate if it's time to move forward or if there are blockers.`;
  }

  // Next actions
  const nextActions: string[] = [];

  if (project.stage === "idea" && daysSinceStageEntry > 3) {
    nextActions.push("Define core value proposition and target user");
    nextActions.push("Create initial validation criteria");
    if (validation.length === 0) nextActions.push("Add validation items to track progress");
  }

  if (project.stage === "development") {
    if (incompleteValidation.length > 0) {
      nextActions.push(`Complete validation items: ${incompleteValidation.slice(0, 3).map((v) => v.label).join(", ")}`);
    }
    nextActions.push("Review and update project metrics");
  }

  if (project.stage === "launch") {
    nextActions.push("Monitor key metrics (visitors, signups, conversion)");
    nextActions.push("Gather user feedback");
  }

  if (allNotes.length === 0) {
    nextActions.push("Add project notes to track decisions and progress");
  }
  if (allMetrics.length === 0) {
    nextActions.push("Start recording key metrics");
  }

  // Estimated stage based on actual progress
  let estimatedStage = project.stage;
  if (validationRate >= 0.8 && currentStageIdx < STAGE_ORDER.length - 1) {
    estimatedStage = STAGE_ORDER[currentStageIdx + 1];
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      stage: project.stage,
      momentum: Math.round(project.momentum),
      priority: project.priority,
      daysSinceCreation,
      daysSinceUpdate,
      daysSinceStageEntry,
      localPath: project.localPath,
    },
    validation: {
      total: totalValidation,
      completed: completedValidation,
      rate: Math.round(validationRate * 100),
      incomplete: incompleteValidation.map((v) => v.label),
    },
    metrics: {
      total: allMetrics.length,
      latestByName: Object.fromEntries(
        Object.entries(
          allMetrics.reduce((acc, m) => {
            if (!acc[m.name] || m.recordedAt > acc[m.name].recordedAt) acc[m.name] = m;
            return acc;
          }, {} as Record<string, typeof allMetrics[0]>)
        ).map(([name, m]) => [name, m.value])
      ),
    },
    stageTransitions: transitions.length,
    stageAssessment,
    momentumTrend,
    blockers,
    nextActions: nextActions.slice(0, 5),
    estimatedStage,
  };
}
