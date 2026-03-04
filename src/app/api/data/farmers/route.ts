import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/data/farmers?round=baseline
 * Supports optional `round` query param (defaults to "baseline").
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const round = req.nextUrl.searchParams.get("round") || "baseline";
  // Sanitize: only allow alphanumeric + hyphen
  if (!/^[a-z0-9-]+$/.test(round)) {
    return NextResponse.json({ error: "Invalid round" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), `src/data/rounds/${round}/farmers.json`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: `Round "${round}" farmers data not found` }, { status: 404 });
  }
}
