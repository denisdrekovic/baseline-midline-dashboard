import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/session";

export type AuthRole = "viewer" | "admin";

interface UserEntry {
  password: string;
  role: AuthRole;
}

// --------------- Rate limiting (in-memory) ---------------
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

// --------------- User parsing ---------------
function parseUsers(): Map<string, UserEntry> {
  const raw = process.env.AUTH_USERS ?? "";
  const map = new Map<string, UserEntry>();

  for (const pair of raw.split(",")) {
    const sep = pair.indexOf(":");
    if (sep < 1) continue;
    const username = pair.slice(0, sep).trim().toLowerCase();
    const password = pair.slice(sep + 1).trim();
    const role: AuthRole = username.startsWith("admin") ? "admin" : "viewer";
    map.set(username, { password, role });
  }
  return map;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// --------------- POST /api/auth — login ---------------
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const users = parseUsers();
    const user = users.get(username.trim().toLowerCase());

    if (!user || !safeEqual(password, user.password)) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Set iron-session cookie
    const session = await getSession();
    session.isLoggedIn = true;
    session.role = user.role;
    session.username = username.trim().toLowerCase();
    await session.save();

    return NextResponse.json({ success: true, role: user.role });
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}

// --------------- DELETE /api/auth — logout ---------------
export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}

// --------------- GET /api/auth — check session ---------------
export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    isLoggedIn: session.isLoggedIn,
    role: session.role ?? null,
  });
}
