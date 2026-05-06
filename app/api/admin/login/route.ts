// app/api/admin/login/route.ts
// Admin login — accepts password via POST, sets HttpOnly session cookie.
// Rate-limited: 10 failed attempts → 1-hour lockout. Lockout sends reset email.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  createAdminSession,
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
} from "@/lib/admin-auth";
import { Resend } from "resend";

export const runtime = "nodejs";

// ── Rate limiting via Upstash Redis ──────────────────────────────────────────
// Key: "admin:login:fails:<ip>"  → integer count, TTL = 1 hour after lockout
// Key: "admin:login:locked:<ip>" → "1", TTL = 1 hour

const MAX_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 60 * 60; // 1 hour

async function getRedis() {
  // Lazy import so the module doesn't crash if env vars are missing
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function checkRateLimit(ip: string): Promise<{ locked: boolean; attempts: number }> {
  try {
    const redis = await getRedis();
    const locked = await redis.get<string>(`admin:login:locked:${ip}`);
    if (locked) return { locked: true, attempts: MAX_ATTEMPTS };
    const attempts = (await redis.get<number>(`admin:login:fails:${ip}`)) || 0;
    return { locked: false, attempts };
  } catch {
    // Redis unavailable — fail open (don't block login)
    return { locked: false, attempts: 0 };
  }
}

async function recordFailure(ip: string): Promise<number> {
  try {
    const redis = await getRedis();
    const key = `admin:login:fails:${ip}`;
    const attempts = await redis.incr(key);
    // Keep the counter for 2 hours so it survives near the lockout window
    await redis.expire(key, LOCKOUT_SECONDS * 2);

    if (attempts >= MAX_ATTEMPTS) {
      // Set lockout key with 1-hour TTL
      await redis.set(`admin:login:locked:${ip}`, "1", { ex: LOCKOUT_SECONDS });
    }
    return attempts;
  } catch {
    return 0;
  }
}

async function clearFailures(ip: string): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.del(`admin:login:fails:${ip}`, `admin:login:locked:${ip}`);
  } catch {}
}

async function sendLockoutEmail(ip: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "hello@webgecko.au";
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "WebGecko Security <hello@webgecko.au>",
      to: adminEmail,
      subject: "⚠️ Admin login locked — too many failed attempts",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
          <h2 style="color:#dc2626;margin:0 0 16px;">Admin Login Locked</h2>
          <p style="color:#374151;margin:0 0 12px;">
            The WebGecko admin login has been locked due to <strong>${MAX_ATTEMPTS} failed attempts</strong>
            from IP <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${ip}</code>.
          </p>
          <p style="color:#374151;margin:0 0 24px;">
            The lockout will automatically clear after <strong>1 hour</strong>. If this wasn't you,
            someone may be attempting to access your admin panel.
          </p>
          <p style="color:#6b7280;font-size:13px;margin:0;">
            — WebGecko Security
          </p>
        </div>
      `,
    });
  } catch {
    // Don't fail the response if email fails
  }
}

// ── POST — verify password ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Check lockout before even parsing the body
  const { locked, attempts: currentAttempts } = await checkRateLimit(ip);
  if (locked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Account locked for 1 hour. Check your email." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = body?.password || "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ADMIN_PASSWORD takes priority; fall back to PROCESS_SECRET for existing deployments
  const expected = process.env.ADMIN_PASSWORD || process.env.PROCESS_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 500 });
  }

  // Constant-time comparison to prevent timing attacks
  let match = false;
  try {
    match =
      password.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    match = false;
  }

  if (!match) {
    const newAttempts = await recordFailure(ip);
    const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);

    // Send lockout email on the attempt that triggers the lock
    if (newAttempts >= MAX_ATTEMPTS) {
      await sendLockoutEmail(ip);
      return NextResponse.json(
        { error: "Too many failed attempts. Account locked for 1 hour. Check your email." },
        { status: 429 }
      );
    }

    const attemptsMsg = remaining <= 3
      ? ` (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`
      : "";
    return NextResponse.json(
      { error: `Invalid password${attemptsMsg}` },
      { status: 401 }
    );
  }

  // Success — clear any previous failure counts
  await clearFailures(ip);

  const token = createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}

// ── DELETE — logout ───────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  return res;
}
