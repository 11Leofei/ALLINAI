import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyCommitments, projects } from "@/lib/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseBody } from "@/lib/api-utils";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET: get commitments for today or a date range
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getToday();
    const range = searchParams.get("range"); // "week" or "month"

    if (range) {
      const now = Date.now();
      const rangeMs =
        range === "month" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const startDate = new Date(now - rangeMs).toISOString().slice(0, 10);

      const commitments = db
        .select()
        .from(dailyCommitments)
        .where(gte(dailyCommitments.date, startDate))
        .orderBy(desc(dailyCommitments.date))
        .all();

      // Get project names
      const allProjects = db.select().from(projects).all();
      const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

      const enriched = commitments.map((c) => ({
        ...c,
        projectName: projectMap.get(c.projectId) || "Unknown",
      }));

      // Stats
      const byDate: Record<string, { total: number; completed: number }> = {};
      for (const c of commitments) {
        if (!byDate[c.date]) byDate[c.date] = { total: 0, completed: 0 };
        byDate[c.date].total++;
        if (c.isCompleted) byDate[c.date].completed++;
      }

      const totalDays = Object.keys(byDate).length;
      const totalCommitments = commitments.length;
      const totalCompleted = commitments.filter((c) => c.isCompleted).length;
      const completionRate = totalCommitments > 0
        ? Math.round((totalCompleted / totalCommitments) * 100)
        : 0;
      const perfectDays = Object.values(byDate).filter(
        (d) => d.total > 0 && d.completed === d.total
      ).length;

      return NextResponse.json({
        commitments: enriched,
        stats: {
          totalDays,
          totalCommitments,
          totalCompleted,
          completionRate,
          perfectDays,
          byDate,
        },
      });
    }

    // Single day — include overdue (carryover) items
    const todayItems = db
      .select()
      .from(dailyCommitments)
      .where(eq(dailyCommitments.date, date))
      .all();

    // Find all incomplete items from previous days (overdue carryover)
    const allItems = db.select().from(dailyCommitments).all();
    const overdueItems = allItems.filter(
      (c) => !c.isCompleted && c.date < date
    );

    const allProjects = db.select().from(projects).all();
    const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

    const enrichToday = todayItems.map((c) => ({
      ...c,
      projectName: projectMap.get(c.projectId) || "Unknown",
      isOverdue: false,
      delayedDays: 0,
    }));

    const enrichOverdue = overdueItems.map((c) => {
      const createdDate = new Date(c.date);
      const today = new Date(date);
      const diffDays = Math.floor(
        (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...c,
        projectName: projectMap.get(c.projectId) || "Unknown",
        isOverdue: true,
        delayedDays: diffDays,
      };
    });

    const commitments = [...enrichOverdue, ...enrichToday];

    return NextResponse.json({
      date,
      commitments,
      summary: {
        total: todayItems.length,
        completed: todayItems.filter((c) => c.isCompleted).length,
        overdue: overdueItems.length,
      },
    });
  } catch (err) {
    console.error("GET commitments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: create a new commitment
export async function POST(req: NextRequest) {
  try {
    const result = await parseBody(req);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (!body.projectId || typeof body.projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!body.commitment || typeof body.commitment !== "string") {
      return NextResponse.json({ error: "commitment is required" }, { status: 400 });
    }

    const id = nanoid();
    const now = Date.now();
    const today = getToday();

    db.insert(dailyCommitments)
      .values({
        id,
        date: today,
        projectId: String(body.projectId),
        commitment: String(body.commitment),
        isCompleted: 0,
        createdAt: now,
      })
      .run();

    return NextResponse.json(
      { id, date: today, projectId: body.projectId, commitment: body.commitment, isCompleted: 0 },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST commitments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: toggle completion or update commitment
export async function PUT(req: NextRequest) {
  try {
    const result = await parseBody(req);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = db
      .select()
      .from(dailyCommitments)
      .where(eq(dailyCommitments.id, String(body.id)))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.isCompleted === "number" || typeof body.isCompleted === "boolean") {
      updates.isCompleted = body.isCompleted ? 1 : 0;
      updates.completedAt = body.isCompleted ? Date.now() : null;
    }
    if (body.commitment && typeof body.commitment === "string") {
      updates.commitment = body.commitment;
    }

    db.update(dailyCommitments).set(updates).where(eq(dailyCommitments.id, String(body.id))).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT commitments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: remove a commitment
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    db.delete(dailyCommitments).where(eq(dailyCommitments.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE commitments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
