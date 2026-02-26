import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { parseBody } from "@/lib/api-utils";

const DB_PATH = path.join(process.cwd(), "data", "allinai.db");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const MAX_BACKUPS = 10;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getBackups(): { name: string; path: string; size: number; createdAt: number }[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db"));
  return files
    .map((name) => {
      const filePath = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        size: stat.size,
        createdAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function cleanOldBackups() {
  const backups = getBackups();
  if (backups.length > MAX_BACKUPS) {
    for (const old of backups.slice(MAX_BACKUPS)) {
      fs.unlinkSync(old.path);
    }
  }
}

// GET: list backups
export async function GET() {
  try {
    const backups = getBackups();
    return NextResponse.json({
      backups: backups.map((b) => ({
        name: b.name,
        size: b.size,
        createdAt: b.createdAt,
      })),
      dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    });
  } catch (err) {
    console.error("GET backup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: create backup
export async function POST() {
  try {
    ensureBackupDir();

    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `allinai-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(DB_PATH, backupPath);

    const walPath = DB_PATH + "-wal";
    const shmPath = DB_PATH + "-shm";
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, backupPath + "-wal");
    }
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, backupPath + "-shm");
    }

    cleanOldBackups();

    return NextResponse.json({
      success: true,
      backup: {
        name: backupName,
        size: fs.statSync(backupPath).size,
        createdAt: Date.now(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error("POST backup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: restore from backup
export async function PUT(req: NextRequest) {
  try {
    const result = await parseBody(req);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Backup name is required" }, { status: 400 });
    }

    const backupPath = path.join(BACKUP_DIR, body.name);

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    // Safety check: only allow files from backup directory
    const resolvedPath = path.resolve(backupPath);
    if (!resolvedPath.startsWith(path.resolve(BACKUP_DIR))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Create a backup of current DB before restoring
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const preRestoreBackup = path.join(BACKUP_DIR, `pre-restore-${timestamp}.db`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestoreBackup);
    }

    fs.copyFileSync(backupPath, DB_PATH);

    const walBackup = backupPath + "-wal";
    const shmBackup = backupPath + "-shm";
    if (fs.existsSync(walBackup)) {
      fs.copyFileSync(walBackup, DB_PATH + "-wal");
    }
    if (fs.existsSync(shmBackup)) {
      fs.copyFileSync(shmBackup, DB_PATH + "-shm");
    }

    cleanOldBackups();

    return NextResponse.json({ success: true, restoredFrom: body.name });
  } catch (err) {
    console.error("PUT backup (restore) error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
