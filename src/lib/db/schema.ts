import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stage: text("stage").notNull().default("idea"),
  tags: text("tags").notNull().default("[]"),
  priority: integer("priority").notNull().default(3),
  momentum: real("momentum").notNull().default(100),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  stageEnteredAt: integer("stage_entered_at").notNull(),
  localPath: text("local_path"),
});

export const stageTransitions = sqliteTable("stage_transitions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  transitionedAt: integer("transitioned_at").notNull(),
  note: text("note"),
});

export const validationItems = sqliteTable("validation_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  isCompleted: integer("is_completed").notNull().default(0),
  completedAt: integer("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: real("value").notNull(),
  recordedAt: integer("recorded_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const nudges = sqliteTable("nudges", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  message: text("message").notNull(),
  type: text("type").notNull(),
  sentAt: integer("sent_at").notNull(),
  dismissed: integer("dismissed").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const dailyCommitments = sqliteTable("daily_commitments", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  commitment: text("commitment").notNull(),
  isCompleted: integer("is_completed").notNull().default(0),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
});

export const gitScans = sqliteTable("git_scans", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scannedAt: integer("scanned_at").notNull(),
  commits7d: integer("commits_7d").notNull().default(0),
  linesAdded: integer("lines_added").notNull().default(0),
  linesRemoved: integer("lines_removed").notNull().default(0),
  lastCommitAt: integer("last_commit_at"),
  branch: text("branch"),
  summary: text("summary"),
});
