import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "allinai.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-create tables on first import
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    stage TEXT NOT NULL DEFAULT 'idea',
    tags TEXT NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 3,
    momentum REAL NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    stage_entered_at INTEGER NOT NULL,
    local_path TEXT
  );

  CREATE TABLE IF NOT EXISTS stage_transitions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    transitioned_at INTEGER NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS validation_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nudges (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Create new tables for commitment & git scanning
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS daily_commitments (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commitment TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS git_scans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scanned_at INTEGER NOT NULL,
    commits_7d INTEGER NOT NULL DEFAULT 0,
    lines_added INTEGER NOT NULL DEFAULT 0,
    lines_removed INTEGER NOT NULL DEFAULT 0,
    last_commit_at INTEGER,
    branch TEXT,
    summary TEXT
  );
`);

// Create indexes for performance
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage);
  CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
  CREATE INDEX IF NOT EXISTS idx_projects_momentum ON projects(momentum);
  CREATE INDEX IF NOT EXISTS idx_stage_transitions_project ON stage_transitions(project_id);
  CREATE INDEX IF NOT EXISTS idx_stage_transitions_at ON stage_transitions(transitioned_at);
  CREATE INDEX IF NOT EXISTS idx_validation_items_project ON validation_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_metrics_project ON metrics(project_id);
  CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
  CREATE INDEX IF NOT EXISTS idx_nudges_sent ON nudges(sent_at);
  CREATE INDEX IF NOT EXISTS idx_nudges_dismissed ON nudges(dismissed);
  CREATE INDEX IF NOT EXISTS idx_commitments_date ON daily_commitments(date);
  CREATE INDEX IF NOT EXISTS idx_commitments_project ON daily_commitments(project_id);
  CREATE INDEX IF NOT EXISTS idx_git_scans_project ON git_scans(project_id);
  CREATE INDEX IF NOT EXISTS idx_git_scans_at ON git_scans(scanned_at);
`);

// Migrate: add local_path column if not exists
try {
  sqlite.exec("ALTER TABLE projects ADD COLUMN local_path TEXT");
} catch {
  // Column already exists
}

// Insert default settings if not exist
const defaultSettings: Record<string, unknown> = {
  "nudge.enabled": true,
  "nudge.staleThresholdDays": {
    idea: 3,
    development: 5,
    launch: 7,
    validation: 5,
    data_collection: 7,
  },
  "nudge.dailyDigestTime": "09:00",
  "nudge.checkIntervalMinutes": 30,
  "momentum.decayRatePerDay": 5,
};

const insertSetting = sqlite.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);

for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, JSON.stringify(value));
}
