// app/api/stripe/webhook/route.ts
// Handles Stripe Connect webhook events.
// Covers: checkout completion (stock), subscription cancellation, and invoice failures.

import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/stripe-connect";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { suspendClientSite } from "@/app/api/payment/webhook/route";

export const runtime = "nodejs";

// Raw body needed for webhook signature verification
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_CONNECT_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read body" }, { status: 400 });
  }

  let event;
  try {
    event = verifyStripeWebhook(rawBody, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook verification failed";
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Handle checkout completion — decrement stock
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { webgecko_job_id?: string; webgecko_product_index?: string };
      amount_total?: number;
      customer_email?: string;
      payment_status?: string;
    };

    const jobId = session.metadata?.webgecko_job_id;
    const productIndex = session.metadata?.webgecko_product_index;

    if (jobId && productIndex !== undefined) {
      try {
        const job = await getJob(jobId);
        if (job?.shopCatalogue) {
          const idx = parseInt(productIndex, 10);
          const catalogue = [...(job.shopCatalogue as any[])];
          const item = catalogue[idx];

          if (item && item.stock !== undefined && item.stock > 0) {
            catalogue[idx] = { ...item, stock: item.stock - 1 };

            // Deactivate payment link if now out of stock
            if (catalogue[idx].stock === 0 && item.paymentLinkId) {
              try {
                const { deactivatePaymentLink } = await import("@/lib/stripe-connect");
                const connectedAccountId = job.stripeAccountId;
                if (connectedAccountId) {
                  await deactivatePaymentLink(item.paymentLinkId, connectedAccountId);
                  console.log(`[Stripe Webhook] Deactivated payment link for "${item.name}" (out of stock)`);
                }
              } catch (e) {
                console.error("[Stripe Webhook] Could not deactivate payment link:", e);
              }
            }

            await saveJob(jobId, { ...job, shopCatalogue: catalogue });

            // Update Supabase clients table too
            await supabase
              .from("clients")
              .update({ shop_catalogue: catalogue })
              .eq("job_id", jobId);

            console.log(`[Stripe Webhook] Stock decremented for job=${jobId} item=${idx} "${item.name}" → ${catalogue[idx].stock}`);
          }
        }
      } catch (e) {
        console.error("[Stripe Webhook] Error updating stock:", e);
      }
    }
  }

  // payment_intent.succeeded — for WebGecko service payments (if we ever use it)
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as { metadata?: { webgecko_job_id?: string; stage?: string }; amount?: number };
    const jobId = pi.metadata?.webgecko_job_id;
    if (jobId) {
      console.log(`[Stripe Webhook] payment_intent.succeeded job=${jobId} amount=${pi.amount}`);
    }
  }

  // ── Subscription cancellation → suspend client site ──────────────────────
  // Fired when a Stripe subscription is explicitly cancelled or reaches its
  // end date without renewal.
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as {
      id: string;
      metadata?: { webgecko_job_id?: string };
      customer?: string;
    };
    const jobId = sub.metadata?.webgecko_job_id;
    if (jobId) {
      console.log(`[Stripe Webhook] Subscription cancelled sub=${sub.id} job=${jobId}`);
      await suspendClientSite(jobId, `Stripe subscription ${sub.id} cancelled`);
    } else {
      console.warn(`[Stripe Webhook] customer.subscription.deleted with no webgecko_job_id — sub=${sub.id}`);
    }
  }

  // ── Invoice payment failure → suspend after 3 consecutive failures ────────
  // Stripe retries failed invoices; we suspend on the final dunning failure
  // (invoice.payment_failed with next_payment_attempt = null).
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as {
      id: string;
      subscription?: string;
      next_payment_attempt?: number | null;
      metadata?: { webgecko_job_id?: string };
      customer_email?: string;
    };
    const jobId = invoice.metadata?.webgecko_job_id;
    const isFinalFailure = invoice.next_payment_attempt === null;

    if (jobId) {
      if (isFinalFailure) {
        console.log(`[Stripe Webhook] Final invoice failure — suspending job=${jobId} invoice=${invoice.id}`);
        await suspendClientSite(jobId, `Stripe invoice ${invoice.id} failed all retries`);
      } else {
        // Intermediate failure — log but don't suspend yet
        console.warn(`[Stripe Webhook] Invoice payment failed (retrying) job=${jobId} invoice=${invoice.id} next_attempt=${invoice.next_payment_attempt}`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
