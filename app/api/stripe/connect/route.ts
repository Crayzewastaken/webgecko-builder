// app/api/stripe/connect/route.ts
// Creates a Stripe Connect account (if needed) and returns an Account Link
// for the client to complete onboarding. Uses Account Links — no OAuth ca_ key needed.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { generateStripeState } from "@/app/api/stripe/callback/route";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "";

  if (!jobId) return new NextResponse("Missing jobId", { status: 400 });

  const adminToken = req.cookies.get("wg_admin")?.value;
  if (!adminToken) return new NextResponse("Not authenticated", { status: 401 });

  const job = await getJob(jobId);
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";

  try {
    let accountId = job.stripeAccountId || "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        country: "AU",
        email: (job as any).clientEmail || undefined,
        metadata: { webgecko_job_id: jobId, client_slug: job.slug || "" },
      });
      accountId = account.id;

      await saveJob(jobId, { ...job, stripeAccountId: accountId });
      if (job.slug) {
        await supabase.from("clients").update({ stripe_account_id: accountId }).eq("slug", job.slug);
      }
    }

    // Include CSRF state token in return URL so callback can verify it
    const state = generateStripeState(jobId);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/api/stripe/connect?jobId=${jobId}`,
      return_url: `${appUrl}/api/stripe/callback?jobId=${jobId}&accountId=${accountId}&state=${state}`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Stripe Connect] Failed to create account/link:", e);
    return new NextResponse("Failed to start Stripe onboarding: " + msg, { status: 500 });
  }
}
