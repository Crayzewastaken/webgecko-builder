import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClient, getJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";

// ── Password hashing helpers ─────────────────────────────────────────────────
// Uses Node crypto scrypt — no extra dependency.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
const HASH_PREFIX = "scrypt:";

/** Hash a plaintext password — returns "scrypt:<salt>:<hash>" */
async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(plaintext, salt, KEY_LEN, SCRYPT_PARAMS, (e, k) => (e ? rej(e) : res(k)))
  );
  return HASH_PREFIX + salt + ":" + hash.toString("hex");
}

/** Timing-safe verify — handles both hashed and legacy plaintext passwords */
async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (stored.startsWith(HASH_PREFIX)) {
    const parts = stored.slice(HASH_PREFIX.length).split(":");
    if (parts.length !== 2) return false;
    const [salt, storedHash] = parts;
    const hash = await new Promise<Buffer>((res, rej) =>
      crypto.scrypt(plaintext, salt, KEY_LEN, SCRYPT_PARAMS, (e, k) => (e ? rej(e) : res(k)))
    );
    return crypto.timingSafeEqual(hash, Buffer.from(storedHash, "hex"));
  }
  // Legacy plaintext — constant-time comparison to prevent timing attacks
  const a = Buffer.from(plaintext);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// POST - login with username + password
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const clientData = await getClient(slug);

    if (!clientData) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const storedPassword = (clientData as Record<string, unknown>).password as string || "";
    const valid = await verifyPassword(password, storedPassword);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // On-the-fly upgrade: if stored as plaintext, re-hash on successful login
    if (!storedPassword.startsWith(HASH_PREFIX)) {
      try {
        const hashed = await hashPassword(password);
        const { supabase } = await import("@/lib/supabase");
        await supabase.from("clients").update({ password: hashed }).eq("slug", slug);
      } catch (e) {
        console.error("[client-login] Password upgrade failed (non-fatal):", e);
      }
    }

    const response = NextResponse.json({ slug, jobId: clientData.job_id });
    response.cookies.set("wg_client_slug", slug, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Client login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

// GET - fetch client portal data by slug
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    if (!sessionSlug || sessionSlug !== slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientData = await getClient(slug);
    if (!clientData) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { password: _, ...safeData } = clientData as Record<string, unknown>;

    // Enrich with job-level data the portal needs (supersaasId, supersaasUrl, etc.)
    // These live on the jobs table, not clients
    if (safeData.job_id) {
      try {
        const job = await getJob(safeData.job_id as string);
        if (job) {
          if (job.supersaasId) safeData.supersaasId = job.supersaasId;
          if (job.supersaasUrl) safeData.supersaasUrl = job.supersaasUrl;
          if (job.tawktoPropertyId) safeData.tawktoPropertyId = job.tawktoPropertyId;
          if (job.squareAccessToken) {
            safeData.squareConnected = true;
            safeData.squareMerchantId = job.squareMerchantId || null;
          }
        }
      } catch (e) {
        console.error("client-login: failed to fetch job data", e);
      }
    }

    return NextResponse.json(safeData);
  } catch (err) {
    console.error("Client portal fetch error:", err);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}

// PATCH - update client settings from the portal (e.g. shop payment URL)
export async function PATCH(req: NextRequest) {
  try {
    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    const body = await req.json();
    const { slug, shopPaymentUrl } = body;

    if (!slug || !sessionSlug || sessionSlug !== slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (shopPaymentUrl !== undefined) {
      if (shopPaymentUrl && !/^https?:\/\/.{4,}/.test(shopPaymentUrl)) {
        return NextResponse.json({ error: "Invalid payment URL" }, { status: 400 });
      }
      const { error } = await supabase
        .from("clients")
        .update({ shop_payment_url: shopPaymentUrl || null })
        .eq("slug", slug);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    console.error("Client PATCH error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
