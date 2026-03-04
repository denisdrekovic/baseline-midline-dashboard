import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  isLoggedIn: boolean;
  role: "viewer" | "admin" | null;
  username: string | null;
}

const defaultSession: SessionData = {
  isLoggedIn: false,
  role: null,
  username: null,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_CHANGE_ME",
  cookieName: "shubhminth-session",
  ttl: 60 * 60 * 8, // 8 hours
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  },
};

/** Get the session from cookies (for use in Server Components & API routes) */
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
    session.role = defaultSession.role;
    session.username = defaultSession.username;
  }

  return session;
}

/** Verify session is authenticated — returns session or null */
export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return session;
}
