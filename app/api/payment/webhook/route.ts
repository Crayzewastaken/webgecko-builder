// app/api/payment/webhook/route.ts
// Square sends payment events here. Must be a raw body handler.
import { NextRequest, NextResponse } from "next/server";
import { verifySquareWebhook } from "@/lib/square";
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

    // On deposit — notify owner to action in admin dashboard (do NOT auto-build)
    // Owner completes SuperSaas checklist in admin, then clicks "Activate & Launch" to trigger build
    if (stage === "deposit") {
      try {
        const job = await getJob(jobId);
        const base = "https://webgecko-builder.vercel.app";
        const secret = encodeURIComponent(process.env.PROCESS_SECRET || "");
        const adminUrl = `${base}/admin?secret=${secret}`;
        const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY!);
        await resend.emails.send({
          from: "WebGecko <hello@webgecko.au>",
          to: process.env.RESULT_TO_EMAIL!,
          subject: `💰 Deposit Received — ${job?.userInput?.businessName || jobId}`,
          html: [
            "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;'>",
            "<h1 style='color:#00c896;'>💰 Deposit Received</h1>",
            "<p style='color:#94a3b8;'>A client has paid their deposit. Complete the checklist below, then activate their build.</p>",
            "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>",
            "<tr><td style='color:#64748b;padding:8px 0;'>Business</td><td style='color:#e2e8f0;font-weight:600;'>" + (job?.userInput?.businessName || "—") + "</td></tr>",
            "<tr><td style='color:#64748b;padding:8px 0;'>Industry</td><td style='color:#e2e8f0;'>" + (job?.userInput?.industry || "—") + "</td></tr>",
            "<tr><td style='color:#64748b;padding:8px 0;'>Email</td><td style='color:#e2e8f0;'>" + (job?.userInput?.email || "—") + "</td></tr>",
            "<tr><td style='color:#64748b;padding:8px 0;'>Job ID</td><td style='color:#475569;font-size:12px;'>" + jobId + "</td></tr>",
            "</table>",
            "<div style='background:#1a0e00;border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:16px 20px;margin:20px 0;'>",
            "<p style='color:#fbbf24;font-weight:700;margin:0 0 10px;'>⚠️ Your action required before build starts:</p>",
            "<ol style='color:#cbd5e1;font-size:14px;line-height:2;margin:0;padding-left:20px;'>",
            "<li>Go to SuperSaas dashboard → New Schedule → name it <strong style='color:#fbbf24;'>" + (job?.userInput?.businessName || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) + "</strong></li>",
            "<li>Configure available hours & days</li>",
            "<li>Add appointment types / services</li>",
            "<li>Set notification email to client</li>",
            "<li>Test a booking</li>",
            "<li>Go to admin dashboard and click <strong>Activate & Launch</strong></li>",
            "</ol>",
            "</div>",
            "<a href='" + adminUrl + "' style='display:inline-block;background:#00c896;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;'>📊 Open Admin Dashboard →</a>",
            "</div>",
          ].join(""),
        });
        console.log(`[Payment] Deposit received for ${jobId} — owner notified, waiting for admin activation`);
      } catch (e) { console.error("Failed to send deposit notification:", e); }
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
