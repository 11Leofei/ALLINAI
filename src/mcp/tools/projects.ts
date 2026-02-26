import { z } from "zod";
import { db, schema } from "../db";
import { eq, desc, like } from "drizzle-orm";
import { nanoid } from "nanoid";

const { projects, stageTransitions } = schema;

export const listProjectsSchema = z.object({
  query: z.string().optional().describe("Search by name/description/tags"),
  stage: z.string().optional().describe("Filter by stage"),
  priority: z.number().optional().describe("Filter by priority (1-5)"),
});

export function listProjects(args: z.infer<typeof listProjectsSchema>) {
  let all = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  let parsed = all.map((p) => ({ ...p, tags: JSON.parse(p.tags) as string[] }));

  if (args.query) {
    const q = args.query.toLowerCase();
    parsed = parsed.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (args.stage) parsed = parsed.filter((p) => p.stage === args.stage);
  if (args.priority) parsed = parsed.filter((p) => p.priority === args.priority);

  return parsed;
}

export const getProjectSchema = z.object({
  projectId: z.string().describe("Project ID"),
});

export function getProject(args: z.infer<typeof getProjectSchema>) {
  const project = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  if (!project) return { error: "Project not found" };
  return { ...project, tags: JSON.parse(project.tags) };
}

export const createProjectSchema = z.object({
  name: z.string().describe("Project name"),
  description: z.string().optional().describe("Project description"),
  tags: z.array(z.string()).optional().describe("Tags"),
  stage: z.string().optional().describe("Initial stage (default: idea)"),
  priority: z.number().min(1).max(5).optional().describe("Priority 1-5 (default: 3)"),
  localPath: z.string().optional().describe("Local project path"),
});

export function createProject(args: z.infer<typeof createProjectSchema>) {
  const now = Date.now();
  const id = nanoid();
  const newProject = {
    id,
    name: args.name,
    description: args.description || null,
    stage: args.stage || "idea",
    tags: JSON.stringify(args.tags || []),
    priority: args.priority || 3,
    momentum: 100,
    createdAt: now,
    updatedAt: now,
    stageEnteredAt: now,
    localPath: args.localPath || null,
  };

  db.insert(projects).values(newProject).run();
  db.insert(stageTransitions).values({
    id: nanoid(),
    projectId: id,
    fromStage: null,
    toStage: newProject.stage,
    transitionedAt: now,
    note: "Project created",
  }).run();

  return { ...newProject, tags: args.tags || [] };
}

export const updateProjectSchema = z.object({
  projectId: z.string().describe("Project ID"),
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().min(1).max(5).optional(),
  stage: z.string().optional(),
  localPath: z.string().optional().describe("Local project path"),
  transitionNote: z.string().optional().describe("Note for stage change"),
});

export function updateProject(args: z.infer<typeof updateProjectSchema>) {
  const now = Date.now();
  const existing = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  if (!existing) return { error: "Project not found" };

  const updates: Record<string, unknown> = { updatedAt: now };
  if (args.name !== undefined) updates.name = args.name;
  if (args.description !== undefined) updates.description = args.description;
  if (args.tags !== undefined) updates.tags = JSON.stringify(args.tags);
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.localPath !== undefined) updates.localPath = args.localPath;

  if (args.stage !== undefined && args.stage !== existing.stage) {
    updates.stage = args.stage;
    updates.stageEnteredAt = now;
    db.insert(stageTransitions).values({
      id: nanoid(),
      projectId: args.projectId,
      fromStage: existing.stage,
      toStage: args.stage,
      transitionedAt: now,
      note: args.transitionNote || null,
    }).run();
  }

  db.update(projects).set(updates).where(eq(projects.id, args.projectId)).run();
  const updated = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  return { ...updated, tags: JSON.parse(updated!.tags) };
}

export const deleteProjectSchema = z.object({
  projectId: z.string().describe("Project ID"),
});

export function deleteProject(args: z.infer<typeof deleteProjectSchema>) {
  db.delete(projects).where(eq(projects.id, args.projectId)).run();
  return { success: true };
}

export const advanceStageSchema = z.object({
  projectId: z.string().describe("Project ID"),
  note: z.string().optional().describe("Transition note"),
});

const STAGE_ORDER = ["idea", "development", "launch", "validation", "data_collection"];

export function advanceStage(args: z.infer<typeof advanceStageSchema>) {
  const project = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  if (!project) return { error: "Project not found" };

  const currentIdx = STAGE_ORDER.indexOf(project.stage);
  if (currentIdx === -1 || currentIdx >= STAGE_ORDER.length - 1) {
    return { error: `Cannot advance from stage: ${project.stage}` };
  }

  const nextStage = STAGE_ORDER[currentIdx + 1];
  return updateProject({
    projectId: args.projectId,
    stage: nextStage,
    transitionNote: args.note,
  });
}
