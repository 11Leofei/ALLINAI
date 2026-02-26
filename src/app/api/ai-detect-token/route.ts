import { NextResponse } from "next/server";
import { getClaudeCodeToken } from "@/lib/ai/provider";

export async function GET() {
  try {
    const token = getClaudeCodeToken();
    return NextResponse.json({
      found: !!token,
      preview: token ? `${token.slice(0, 14)}...${token.slice(-6)}` : null,
    });
  } catch (err) {
    console.error("GET ai-detect-token error:", err);
    return NextResponse.json({ found: false, preview: null });
  }
}
