import { z } from "zod";
import { db, schema } from "../db";
import { eq, asc } from "drizzle-orm";
import { nanoid } from "nanoid";

const { validationItems, projects } = schema;

export const addValidationItemSchema = z.object({
  projectId: z.string().describe("Project ID"),
  label: z.string().describe("Validation item description"),
});

export function addValidationItem(args: z.infer<typeof addValidationItemSchema>) {
  const now = Date.now();
  const item = {
    id: nanoid(),
    projectId: args.projectId,
    label: args.label,
    isCompleted: 0,
    completedAt: null,
    sortOrder: 0,
  };
  db.insert(validationItems).values(item).run();
  db.update(projects).set({ updatedAt: now }).where(eq(projects.id, args.projectId)).run();
  return { ...item, isCompleted: false };
}

export const toggleValidationSchema = z.object({
  itemId: z.string().describe("Validation item ID"),
});

export function toggleValidation(args: z.infer<typeof toggleValidationSchema>) {
  const now = Date.now();
  const item = db.select().from(validationItems).where(eq(validationItems.id, args.itemId)).get();
  if (!item) return { error: "Validation item not found" };

  const newCompleted = item.isCompleted ? 0 : 1;
  db.update(validationItems).set({
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
  }).where(eq(validationItems.id, args.itemId)).run();
  db.update(projects).set({ updatedAt: now }).where(eq(projects.id, item.projectId)).run();

  return { ...item, isCompleted: !!newCompleted };
}

export const listValidationSchema = z.object({
  projectId: z.string().describe("Project ID"),
});

export function listValidation(args: z.infer<typeof listValidationSchema>) {
  return db.select().from(validationItems)
    .where(eq(validationItems.projectId, args.projectId))
    .orderBy(asc(validationItems.sortOrder))
    .all()
    .map((i) => ({ ...i, isCompleted: !!i.isCompleted }));
}
