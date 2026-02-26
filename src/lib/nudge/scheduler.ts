import cron from "node-cron";
import { checkNudges } from "./engine";
import { sendNotification } from "./notifier";

let isInitialized = false;

export function initNudgeScheduler(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Run nudge check every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    try {
      const nudgeResults = checkNudges();
      for (const nudge of nudgeResults) {
        sendNotification("ALLINAI", nudge.message);
      }
    } catch (error) {
      console.error("Nudge check failed:", error);
    }
  });

  console.log("[ALLINAI] Nudge scheduler initialized");
}
