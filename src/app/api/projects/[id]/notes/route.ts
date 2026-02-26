import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseBody } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allNotes = db
      .select()
      .from(notes)
      .where(eq(notes.projectId, id))
      .orderBy(desc(notes.createdAt))
      .all();
    return NextResponse.json(allNotes);
  } catch (err) {
    console.error("GET notes error:", err);
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

    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const now = Date.now();
    const note = {
      id: nanoid(),
      projectId: id,
      content: String(body.content),
      createdAt: now,
    };

    db.insert(notes).values(note).run();
    db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("POST notes error:", err);
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

    if (body.id && body.content !== undefined) {
      db.update(notes)
        .set({ content: String(body.content) })
        .where(eq(notes.id, String(body.id)))
        .run();
      db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT notes error:", err);
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
      db.delete(notes).where(eq(notes.id, String(body.id))).run();
      db.update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
