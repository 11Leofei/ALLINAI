import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJsonParse, parseBody } from "@/lib/api-utils";

export async function GET() {
  try {
    const allSettings = db.select().from(settings).all();
    const result: Record<string, unknown> = {};
    for (const s of allSettings) {
      result[s.key] = safeJsonParse(s.value, s.value);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await parseBody(request);
    if (result.error) return result.error;
    const body = result.data as Record<string, unknown>;

    for (const [key, value] of Object.entries(body)) {
      const existing = db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (existing) {
        db.update(settings)
          .set({ value: JSON.stringify(value) })
          .where(eq(settings.key, key))
          .run();
      } else {
        db.insert(settings)
          .values({ key, value: JSON.stringify(value) })
          .run();
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
