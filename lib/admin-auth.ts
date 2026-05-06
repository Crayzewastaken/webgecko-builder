// lib/admin-auth.ts
// Helpers for cookie-based admin session auth.

import crypto from "crypto";
import { NextRequest } from "next/server";

const COOKIE_NAME = "wg_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.PROCESS_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET or PROCESS_SECRET env var required");
  return s;
}

export function createAdminSession(): string {
  const payload = Buffer.from(
    JSON.stringify({ ts: Date.now(), nonce: crypto.randomBytes(8).toString("hex") })
  ).toString("base64url");
  const secret = getSessionSecret();
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function isAdminAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const secret = getSessionSecret();
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
      return false;
    }
    const { ts } = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    return Date.now() - ts < SESSION_MAX_AGE * 1000;
  } catch {
    return false;
  }
}

export function isAdminAuthedLegacy(req: NextRequest): boolean {
  if (isAdminAuthed(req)) return true;
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret && secret === process.env.PROCESS_SECRET) return true;
  return false;
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME, SESSION_MAX_AGE as ADMIN_SESSION_MAX_AGE };
