import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import fs from "fs/promises";
import path from "path";

const VALID_FILES = new Set(["districts.geojson", "taluks.geojson"]);

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name || !VALID_FILES.has(name)) {
    return NextResponse.json({ error: "Invalid geo file" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), `src/data/geo/${name}`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Geo file not found" }, { status: 404 });
  }
}
