import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { metrics, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseBody } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allMetrics = db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, id))
      .orderBy(desc(metrics.recordedAt))
      .all();
    return NextResponse.json(allMetrics);
  } catch (err) {
    console.error("GET metrics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (body.value === undefined || isNaN(Number(body.value))) {
      return NextResponse.json({ error: "value must be a number" }, { status: 400 });
    }

    const now = Date.now();
    const metric = {
      id: nanoid(),
      projectId: id,
      name: String(body.name),
      value: Number(body.value),
      recordedAt: Number(body.recordedAt) || now,
    };

    db.insert(metrics).values(metric).run();
    db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();

    return NextResponse.json(metric, { status: 201 });
  } catch (err) {
    console.error("POST metrics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;
    const now = Date.now();

    if (body.id) {
      db.delete(metrics).where(eq(metrics.id, String(body.id))).run();
      db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE metrics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
