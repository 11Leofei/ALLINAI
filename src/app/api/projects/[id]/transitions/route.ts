import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stageTransitions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transitions = db
      .select()
      .from(stageTransitions)
      .where(eq(stageTransitions.projectId, id))
      .orderBy(desc(stageTransitions.transitionedAt))
      .all();

    return NextResponse.json(transitions);
  } catch (err) {
    console.error("GET transitions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
