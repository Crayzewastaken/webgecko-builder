// middleware.ts
// Protects /admin page routes — redirects unauthenticated to /admin/login.
// Uses Web Crypto API (Edge Runtime compatible — no Node.js crypto import).

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "wg_admin_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000; // 30 days

async function isValidSession(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.PROCESS_SECRET;
  if (!secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
    );
    const bodyBytes = enc.encode(body);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
    if (!valid) return false;
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return Date.now() - payload.ts < SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login") &&
    !pathname.startsWith("/api/")
  ) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const valid = token ? await isValidSession(token) : false;
    if (!valid) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
