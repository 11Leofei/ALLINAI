import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nudges } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { checkNudges } from "@/lib/nudge/engine";
import { parseBody } from "@/lib/api-utils";

export async function GET() {
  try {
    const allNudges = db
      .select()
      .from(nudges)
      .orderBy(desc(nudges.sentAt))
      .limit(50)
      .all();

    return NextResponse.json(allNudges);
  } catch (err) {
    console.error("GET nudges error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Trigger a nudge check manually
export async function POST() {
  try {
    const results = checkNudges();
    return NextResponse.json({ nudges: results, count: results.length });
  } catch (err) {
    console.error("POST nudges error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Mark nudges as read or dismiss them
export async function PUT(request: NextRequest) {
  try {
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    if (body.id) {
      db.update(nudges)
        .set({ dismissed: 1 })
        .where(eq(nudges.id, String(body.id)))
        .run();
    } else if (body.dismissAll) {
      const allNudges = db.select().from(nudges).all();
      for (const nudge of allNudges) {
        db.update(nudges)
          .set({ dismissed: 1 })
          .where(eq(nudges.id, nudge.id))
          .run();
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT nudges error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
