import { z } from "zod";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

const { notes, projects } = schema;

export const addNoteSchema = z.object({
  projectId: z.string().describe("Project ID"),
  content: z.string().describe("Note content"),
});

export function addNote(args: z.infer<typeof addNoteSchema>) {
  const now = Date.now();
  const note = {
    id: nanoid(),
    projectId: args.projectId,
    content: args.content,
    createdAt: now,
  };
  db.insert(notes).values(note).run();
  db.update(projects).set({ updatedAt: now }).where(eq(projects.id, args.projectId)).run();
  return note;
}

export const listNotesSchema = z.object({
  projectId: z.string().describe("Project ID"),
});

export function listNotes(args: z.infer<typeof listNotesSchema>) {
  return db.select().from(notes)
    .where(eq(notes.projectId, args.projectId))
    .orderBy(desc(notes.createdAt))
    .all();
}
