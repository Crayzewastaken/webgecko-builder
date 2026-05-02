// app/api/payment/webhook/route.ts
// Square sends payment events here. Must be a raw body handler.
import { NextRequest, NextResponse } from "next/server";
import { verifySquareWebhook } from "@/lib/square";
import { inngest } from "@/lib/inngest";
import { getJob, getPaymentState, savePaymentState, getClient, saveClient } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";

  const webhookUrl = `https://webgecko-builder.vercel.app/api/payment/webhook`;
  const isValid = await verifySquareWebhook(rawBody, signatureHeader, webhookUrl);

  if (!isValid) {
    console.error("Square webhook: invalid signature — request rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const eventType: string = event.type || "";
  console.log(`Square webhook received: ${eventType}`);

  if (eventType === "payment.completed" || eventType === "payment.updated") {
    const payment = event.data?.object?.payment;
    if (!payment) return NextResponse.json({ ok: true });

    const squarePaymentId: string = payment.id;
    const status: string = payment.status;
    const orderId: string = payment.order_id;

    if (status !== "COMPLETED") return NextResponse.json({ ok: true });

    let referenceId: string = payment.reference_id || "";

    if (!referenceId && orderId) {
      try {
        const orderRes = await fetch(
          `${process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com"}/v2/orders/${orderId}`,
          { headers: { "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2024-11-20" } }
        );
        const orderData = await orderRes.json();
        referenceId = orderData.order?.reference_id || "";
      } catch (e) { console.error("Failed to fetch Square order:", e); }
    }

    if (!referenceId) return NextResponse.json({ ok: true });

    const lastDash = referenceId.lastIndexOf("-");
    const stage = referenceId.slice(lastDash + 1) as "deposit" | "final" | "monthly";
    const jobId = referenceId.slice(0, lastDash);

    if (!["deposit", "final", "monthly"].includes(stage)) return NextResponse.json({ ok: true });

    // Update payment state in Supabase
    const existing = await getPaymentState(jobId) || { payments: {} };
    const payments = { ...(existing.payments || {}) };
    if (payments[stage]) {
      payments[stage] = { ...payments[stage], status: "paid", paidAt: new Date().toISOString(), squarePaymentId };
    }

    await savePaymentState(jobId, {
      ...existing,
      depositPaid: stage === "deposit" ? true : (existing.deposit_paid ?? existing.depositPaid ?? false),
      finalPaid: stage === "final" ? true : (existing.final_paid ?? existing.finalPaid ?? false),
      monthlyActive: stage === "monthly" ? true : (existing.monthly_active ?? existing.monthlyActive ?? false),
      payments,
    });

    console.log(`Payment confirmed: jobId=${jobId} stage=${stage}`);

    // Trigger Inngest build on deposit
    if (stage === "deposit") {
      try {
        await inngest.send({ name: "build/website", data: { jobId } });
      } catch (e) { console.error("Failed to trigger build:", e); }
    }

    // Mark launch ready on final payment
    if (stage === "final") {
      try {
        const job = await getJob(jobId);
        if (job?.clientSlug) {
          const client = await getClient(job.clientSlug);
          if (client) await saveClient(job.clientSlug, { ...client, launch_ready: true });
        }
      } catch (e) { console.error("Failed to update launch status:", e); }
    }
  }

  return NextResponse.json({ ok: true });
}
