import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, stageTransitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { updateProjectMomentum } from "@/lib/nudge/momentum";
import { safeJsonParse, parseBody } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.select().from(projects).where(eq(projects.id, id)).get();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const momentum = updateProjectMomentum(id);

    return NextResponse.json({
      ...project,
      tags: safeJsonParse<string[]>(project.tags, []),
      momentum,
    });
  } catch (err) {
    console.error("GET /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;
    const now = Date.now();

    const existing = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.name !== undefined) updates.name = String(body.name);
    if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
    if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
    if (body.priority !== undefined) updates.priority = Number(body.priority);
    if (body.localPath !== undefined) updates.localPath = body.localPath || null;

    if (body.stage !== undefined && body.stage !== existing.stage) {
      updates.stage = String(body.stage);
      updates.stageEnteredAt = now;

      db.insert(stageTransitions)
        .values({
          id: nanoid(),
          projectId: id,
          fromStage: existing.stage,
          toStage: String(body.stage),
          transitionedAt: now,
          note: body.transitionNote ? String(body.transitionNote) : null,
        })
        .run();
    }

    db.update(projects).set(updates).where(eq(projects.id, id)).run();

    const updated = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!updated) {
      return NextResponse.json({ error: "Project not found after update" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      tags: safeJsonParse<string[]>(updated.tags, []),
    });
  } catch (err) {
    console.error("PUT /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    db.delete(projects).where(eq(projects.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
