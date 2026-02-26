import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, stageTransitions } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { desc } from "drizzle-orm";
import { safeJsonParse, parseBody, validateRequired } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase();
    const stage = searchParams.get("stage");
    const priority = searchParams.get("priority");
    const tag = searchParams.get("tag");
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "0");

    const allProjects = db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .all();

    let parsed = allProjects.map((p) => ({
      ...p,
      tags: safeJsonParse<string[]>(p.tags, []),
    }));

    if (query) {
      parsed = parsed.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (stage) parsed = parsed.filter((p) => p.stage === stage);
    if (priority) parsed = parsed.filter((p) => p.priority === parseInt(priority));
    if (tag) parsed = parsed.filter((p) => p.tags.includes(tag));

    if (limit > 0) {
      const total = parsed.length;
      const offset = page * limit;
      const paged = parsed.slice(offset, offset + limit);
      return NextResponse.json({
        data: paged,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    const missing = validateRequired(body, ["name"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const now = Date.now();
    const id = nanoid();

    const newProject = {
      id,
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      stage: String(body.stage || "idea"),
      tags: JSON.stringify(body.tags || []),
      priority: Number(body.priority) || 3,
      momentum: 100,
      createdAt: now,
      updatedAt: now,
      stageEnteredAt: now,
      localPath: body.localPath ? String(body.localPath) : null,
    };

    db.insert(projects).values(newProject).run();
    db.insert(stageTransitions)
      .values({
        id: nanoid(),
        projectId: id,
        fromStage: null,
        toStage: newProject.stage,
        transitionedAt: now,
        note: "Project created",
      })
      .run();

    return NextResponse.json({
      ...newProject,
      tags: body.tags || [],
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
