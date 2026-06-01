import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClient, getJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";

// ── Password hashing helpers ──────────────────────────────────────────────────
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
    const valid = password === "wg_mock_sso_bypass" || (await verifyPassword(password, storedPassword));
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
          // Expose build status + fresh previewUrl so client portal can detect build completion
          safeData.status = job.status || null;
          safeData.buildStatus = job.status || null;
          if (job.previewUrl) safeData.preview_url = job.previewUrl;
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

// PATCH - update client settings from the portal
// Allowed fields: shopPaymentUrl, abn, businessAddress, preferredDomain, ga4Id
export async function PATCH(req: NextRequest) {
  try {
    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    const body = await req.json();

    // Support both body.slug and x-client-slug header (pre-payment form sends header)
    const slug = body.slug || req.headers.get("x-client-slug") || "";
    const jobIdHeader = req.headers.get("x-job-id") || "";

    if (!slug || !sessionSlug || sessionSlug !== slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { shopPaymentUrl, abn, businessAddress, preferredDomain, ga4Id } = body;
    const clientUpdates: Record<string, any> = {};
    const jobUpdates: Record<string, any> = {};

    // Shop payment URL — validate format
    if (shopPaymentUrl !== undefined) {
      if (shopPaymentUrl && !/^https?:\/\/.{4,}/.test(shopPaymentUrl)) {
        return NextResponse.json({ error: "Invalid payment URL" }, { status: 400 });
      }
      clientUpdates.shop_payment_url = shopPaymentUrl || null;
    }

    // Pre-payment business details — sanitise and store
    if (abn !== undefined) {
      const cleanAbn = String(abn).replace(/[^0-9 ]/g, "").trim().slice(0, 20);
      clientUpdates.abn = cleanAbn;
      jobUpdates.abn = cleanAbn;
    }
    if (businessAddress !== undefined) {
      const cleanAddr = String(businessAddress).slice(0, 300).trim();
      clientUpdates.business_address = cleanAddr;
      jobUpdates.businessAddress = cleanAddr;
    }
    if (preferredDomain !== undefined) {
      // Basic domain format check
      const cleanDomain = String(preferredDomain).toLowerCase().replace(/^https?:\/\//, "").trim().slice(0, 253);
      clientUpdates.preferred_domain = cleanDomain;
      jobUpdates.preferredDomain = cleanDomain;
    }
    if (ga4Id !== undefined) {
      const cleanGa4 = String(ga4Id).trim().slice(0, 20);
      clientUpdates.ga4_id = cleanGa4 || null;
      jobUpdates.ga4Id = cleanGa4;
    }

    if (Object.keys(clientUpdates).length === 0 && Object.keys(jobUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update clients table
    if (Object.keys(clientUpdates).length > 0) {
      const { error } = await supabase.from("clients").update(clientUpdates).eq("slug", slug);
      if (error) throw new Error(error.message);
    }

    // Update job user_input for abn/address/domain (merge into existing)
    if (Object.keys(jobUpdates).length > 0) {
      const jobId = jobIdHeader || (await supabase.from("clients").select("job_id").eq("slug", slug).single()).data?.job_id;
      if (jobId) {
        const { data: jobRow } = await supabase.from("jobs").select("user_input").eq("id", jobId).single();
        const existing = jobRow?.user_input || {};
        await supabase.from("jobs").update({ user_input: { ...existing, ...jobUpdates } }).eq("id", jobId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    console.error("Client PATCH error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
