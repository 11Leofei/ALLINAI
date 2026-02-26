import { NextResponse } from "next/server";
import { initScheduler } from "@/lib/cron/scheduler";

// GET: initialize the cron scheduler (called once on app load)
export async function GET() {
  try {
    initScheduler();
    return NextResponse.json({ status: "scheduler_running" });
  } catch (err) {
    console.error("GET cron error:", err);
    return NextResponse.json({ error: "Failed to initialize scheduler" }, { status: 500 });
  }
}
