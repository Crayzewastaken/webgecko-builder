// middleware.ts
// Protects /admin routes.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "wg_admin_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000; // 30 days

function isValidSession(token: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.PROCESS_SECRET;
  if (!secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
    const { ts } = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    return Date.now() - ts < SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token || !isValidSession(token)) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
