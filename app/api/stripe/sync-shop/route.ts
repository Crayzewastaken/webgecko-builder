// app/api/stripe/sync-shop/route.ts
// Admin-triggered: creates Stripe Products + Payment Links for a client's shop.
// WebGecko takes 2% application fee on every transaction.
// POST { jobId, products: ShopProduct[] }

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { createStripeShopCatalogue, ShopProduct } from "@/lib/stripe-connect";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Verify admin secret
  if (!isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string; products?: ShopProduct[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, products } = body;
  if (!jobId || !products?.length) {
    return NextResponse.json({ error: "Missing jobId or products" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const connectedAccountId = job.stripeAccountId;
  if (!connectedAccountId) {
    return NextResponse.json(
      { error: "Client has not connected Stripe. Use /api/stripe/connect first." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app";
  const redirectUrl = job.liveUrl || job.previewUrl || appUrl;
  const businessName = job.businessName || "Business";

  try {
    const items = await createStripeShopCatalogue({
      connectedAccountId,
      products,
      redirectUrl,
      jobId,
      businessName,
    });

    // Save catalogue to job
    await saveJob(jobId, {
      ...job,
      shopCatalogue: items,
      shopSyncedAt: new Date().toISOString(),
      shopPlatform: "stripe",
    });

    // Also save to clients table for easy lookup
    await supabase
      .from("clients")
      .update({
        shop_catalogue: items,
        shop_synced_at: new Date().toISOString(),
        shop_platform: "stripe",
      })
      .eq("job_id", jobId);

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("[Stripe Sync] Error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
