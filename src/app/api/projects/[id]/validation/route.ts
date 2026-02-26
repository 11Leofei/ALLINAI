import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validationItems, projects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseBody } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const items = db
      .select()
      .from(validationItems)
      .where(eq(validationItems.projectId, id))
      .orderBy(asc(validationItems.sortOrder))
      .all();

    return NextResponse.json(
      items.map((i) => ({ ...i, isCompleted: !!i.isCompleted }))
    );
  } catch (err) {
    console.error("GET validation error:", err);
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

    if (!body.label || typeof body.label !== "string") {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const now = Date.now();
    const item = {
      id: nanoid(),
      projectId: id,
      label: String(body.label),
      isCompleted: 0,
      completedAt: null,
      sortOrder: Number(body.sortOrder) || 0,
    };

    db.insert(validationItems).values(item).run();
    db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();

    return NextResponse.json({ ...item, isCompleted: false }, { status: 201 });
  } catch (err) {
    console.error("POST validation error:", err);
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

    if (body.id) {
      const updates: Record<string, unknown> = {};
      if (body.label !== undefined) updates.label = String(body.label);
      if (body.isCompleted !== undefined) {
        updates.isCompleted = body.isCompleted ? 1 : 0;
        updates.completedAt = body.isCompleted ? now : null;
      }
      if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);

      db.update(validationItems)
        .set(updates)
        .where(eq(validationItems.id, String(body.id)))
        .run();
      db.update(projects)
        .set({ updatedAt: now })
        .where(eq(projects.id, id))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT validation error:", err);
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
      db.delete(validationItems).where(eq(validationItems.id, String(body.id))).run();
      db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE validation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
