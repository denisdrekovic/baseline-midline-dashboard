import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import fs from "fs/promises";
import path from "path";

const VALID_CROPS = new Set(["mint", "rice", "potato", "mustard", "wheat"]);

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crop = req.nextUrl.searchParams.get("crop");
  if (!crop || !VALID_CROPS.has(crop)) {
    return NextResponse.json({ error: "Invalid crop" }, { status: 400 });
  }

  const round = req.nextUrl.searchParams.get("round") || "baseline";
  if (!/^[a-z0-9-]+$/.test(round)) {
    return NextResponse.json({ error: "Invalid round" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), `src/data/rounds/${round}/crops/${crop}.json`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Crop data not found" }, { status: 404 });
  }
}
