// app/api/stripe/callback/route.ts
// Handles return from Stripe Account Link onboarding.
// Marks the account as connected and redirects back to admin.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
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

  if (!jobId || !accountId) return failPage("Missing jobId or accountId");

  const stripe = getStripe();

  try {
    // Verify the account actually completed onboarding
    const account = await stripe.accounts.retrieve(accountId);
    const isReady = account.details_submitted;

    const job = await getJob(jobId);
    if (job) {
      await saveJob(jobId, {
        ...job,
        stripeAccountId: accountId,
        stripeConnectedAt: new Date().toISOString(),
        // Store onboarding status — not fully ready until details_submitted
      });
    }

    if (job?.slug) {
      await supabase
        .from("clients")
        .update({
          stripe_account_id: accountId,
          stripe_connected_at: new Date().toISOString(),
        })
        .eq("slug", job.slug);
    }

    console.log(`[Stripe Callback] account=${accountId} job=${jobId} details_submitted=${isReady}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
    const status = isReady ? "connected" : "pending";
    return NextResponse.redirect(`${appUrl}/admin?stripe=${status}&jobId=${jobId}`);
  } catch (e) {
    console.error("[Stripe Callback] Error:", e);
    return failPage("Failed to verify Stripe account: " + (e instanceof Error ? e.message : String(e)));
  }
}
