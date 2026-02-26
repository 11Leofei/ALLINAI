import { NextRequest, NextResponse } from "next/server";
import { scanAllProjects, scanSingleProject } from "@/lib/cron/git-scanner";
import { db } from "@/lib/db";
import { gitScans } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseBody } from "@/lib/api-utils";

// GET: get scan history for a project, or scan all
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      const scans = db
        .select()
        .from(gitScans)
        .where(eq(gitScans.projectId, projectId))
        .orderBy(desc(gitScans.scannedAt))
        .limit(20)
        .all();
      return NextResponse.json(scans);
    }

    const allScans = db
      .select()
      .from(gitScans)
      .orderBy(desc(gitScans.scannedAt))
      .limit(100)
      .all();
    return NextResponse.json(allScans);
  } catch (err) {
    console.error("GET git-scan error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: trigger a scan
export async function POST(req: NextRequest) {
  try {
    const result = await parseBody(req);
    const body = result.error ? {} : (result.data as Record<string, unknown>);
    const projectId = body.projectId;

    if (projectId) {
      const scanResult = await scanSingleProject(String(projectId));
      if (!scanResult) {
        return NextResponse.json(
          { error: "Project not found or no local path configured" },
          { status: 404 }
        );
      }
      return NextResponse.json(scanResult);
    }

    const results = await scanAllProjects();
    return NextResponse.json({
      scanned: results.length,
      results,
    });
  } catch (err) {
    console.error("POST git-scan error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
