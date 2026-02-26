import cron from "node-cron";
import { db } from "@/lib/db";
import { projects, dailyCommitments, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scanAllProjects } from "./git-scanner";
import {
  notifyMorningCommitment,
  notifyEveningCheckIn,
  notifyStaleProject,
  notifyGitScanComplete,
  notifyMomentumDrop,
} from "./notifier";

let initialized = false;

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSetting(key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

async function runGitScan() {
  console.log("[ALLINAI Cron] Running git scan...");
  try {
    const results = await scanAllProjects();
    if (results.length > 0) {
      notifyGitScanComplete(results.length, results.filter((r) => r.commits7d > 0).length);

      // Check for momentum drops
      for (const r of results) {
        if (r.momentumDelta < -10) {
          const proj = db.select().from(projects).where(eq(projects.id, r.projectId)).get();
          if (proj && proj.momentum < 30) {
            notifyMomentumDrop(proj.name, proj.momentum);
          }
        }
      }
    }
    console.log(`[ALLINAI Cron] Scanned ${results.length} projects`);
  } catch (err) {
    console.error("[ALLINAI Cron] Git scan error:", err);
  }
}

function runMorningNotification() {
  const enabled = getSetting("nudge.enabled");
  if (enabled === false) return;

  console.log("[ALLINAI Cron] Morning notification");
  const activeProjects = db
    .select()
    .from(projects)
    .all()
    .filter((p) => p.stage !== "archived");
  notifyMorningCommitment(activeProjects.length);
}

function runEveningCheckIn() {
  const enabled = getSetting("nudge.enabled");
  if (enabled === false) return;

  console.log("[ALLINAI Cron] Evening check-in");
  const today = getToday();
  const todayCommitments = db
    .select()
    .from(dailyCommitments)
    .where(eq(dailyCommitments.date, today))
    .all();
  const completed = todayCommitments.filter((c) => c.isCompleted);
  notifyEveningCheckIn(todayCommitments.length, completed.length);
}

function runStaleCheck() {
  const enabled = getSetting("nudge.enabled");
  if (enabled === false) return;

  const thresholds = getSetting("nudge.staleThresholdDays") as Record<string, number> | null;
  if (!thresholds) return;

  const allProjects = db
    .select()
    .from(projects)
    .all()
    .filter((p) => p.stage !== "archived");

  const now = Date.now();
  for (const p of allProjects) {
    const threshold = thresholds[p.stage] || 5;
    const days = Math.floor((now - p.stageEnteredAt) / (1000 * 60 * 60 * 24));
    if (days >= threshold) {
      // Only notify once per day per project
      const stageLabel = p.stage;
      notifyStaleProject(p.name, days, stageLabel);
      break; // Only one stale notification at a time to avoid spam
    }
  }
}

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  console.log("[ALLINAI Cron] Initializing scheduler...");

  // Get digest time from settings (default "09:00")
  const digestTime = (getSetting("nudge.dailyDigestTime") as string) || "09:00";
  const [hour, minute] = digestTime.split(":").map(Number);

  // Morning commitment reminder - at configured time
  cron.schedule(`${minute} ${hour} * * *`, () => {
    runMorningNotification();
  });

  // Evening check-in - at 21:00
  cron.schedule("0 21 * * *", () => {
    runEveningCheckIn();
  });

  // Git scan - every 2 hours during work time (8-22)
  cron.schedule("0 8-22/2 * * *", () => {
    runGitScan();
  });

  // Stale project check - at 10:00 and 15:00
  cron.schedule("0 10,15 * * *", () => {
    runStaleCheck();
  });

  console.log("[ALLINAI Cron] Scheduler ready:");
  console.log(`  - Morning reminder: ${digestTime}`);
  console.log("  - Evening check-in: 21:00");
  console.log("  - Git scan: every 2h (8-22)");
  console.log("  - Stale check: 10:00, 15:00");
}
