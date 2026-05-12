// app/api/stripe/callback/route.ts
// Handles return from Stripe Account Link onboarding.
// CSRF protection: validates the state param (HMAC of jobId signed with PROCESS_SECRET).
// Marks the account as connected and redirects back to admin.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import crypto from "crypto";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

/** Generate a CSRF state token for a given jobId */
export function generateStripeState(jobId: string): string {
  const secret = process.env.PROCESS_SECRET || "";
  return crypto.createHmac("sha256", secret).update("stripe:" + jobId).digest("base64url");
}

/** Verify the state token matches the jobId */
function verifyStripeState(jobId: string, state: string): boolean {
  try {
    const expected = generateStripeState(jobId);
    return crypto.timingSafeEqual(Buffer.from(state, "base64url"), Buffer.from(expected, "base64url"));
  } catch {
    return false;
  }
}

function failPage(msg: string) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>Stripe Connection Failed</title></head>
    <body style="font-family:sans-serif;background:#0a0f1a;color:#e2e8f0;padding:60px 24px;text-align:center;">
      <h1 style="color:#ef4444;">Connection Failed</h1>
      <p>${msg}</p>
      <a href="/admin" style="color:#00c896;">Back to Admin</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "";
  const accountId = searchParams.get("accountId") || "";
  const state = searchParams.get("state") || "";

  if (!jobId || !accountId) return failPage("Missing jobId or accountId");

  // Validate CSRF state token
  if (!state || !verifyStripeState(jobId, state)) {
    console.error(`[Stripe Callback] Invalid state for jobId=${jobId}`);
    return failPage("Invalid or missing state parameter. Please try connecting Stripe again.");
  }

  const stripe = getStripe();

  try {
    // Verify the account actually completed onboarding via Stripe API (not just URL params)
    const account = await stripe.accounts.retrieve(accountId);
    const isReady = account.details_submitted;

    const job = await getJob(jobId);
    if (job) {
      await saveJob(jobId, {
        ...job,
        stripeAccountId: accountId,
        stripeConnectedAt: new Date().toISOString(),
      });
    }

    if (job?.clientSlug) {
      await supabase
        .from("clients")
        .update({
          stripe_account_id: accountId,
          stripe_connected_at: new Date().toISOString(),
        })
        .eq("slug", job.clientSlug);
    }

    console.log(`[Stripe Callback] account=${accountId} job=${jobId} details_submitted=${isReady}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app";
    const status = isReady ? "connected" : "pending";
    // Don't expose jobId in redirect URL
    return NextResponse.redirect(`${appUrl}/admin?stripe=${status}`);
  } catch (e) {
    console.error("[Stripe Callback] Error:", e);
    return failPage("Failed to verify Stripe account: " + (e instanceof Error ? e.message : String(e)));
  }
}
