// app/api/payment/webhook/route.ts
// Square sends payment events here. Must be a raw body handler.
import { NextRequest, NextResponse } from "next/server";
import { verifySquareWebhook } from "@/lib/square";
import { getJob, saveJob, getPaymentState, savePaymentState, getClient, saveClient } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app"}/api/payment/webhook`;
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

    // On deposit — auto-build immediately UNLESS booking is requested.
    // Booking requires SuperSaas schedule to be set up first (Step 0 creates it automatically,
    // but we still notify admin so they can verify the schedule looks right).
    // For everything else (no features, gallery, blog, shop, video, etc.) — fully automated.
    if (stage === "deposit") {
      try {
        const job = await getJob(jobId);
        const features: string[] = Array.isArray(job?.userInput?.features) ? job.userInput.features : [];
        const hasBooking = features.includes("Booking System") || !!job?.hasBooking;
        const base = (process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app");
        const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY!);

        if (!hasBooking) {
          // ── FULLY AUTOMATED: trigger build immediately ──────────────────────
          console.log(`[Payment] No booking feature — auto-triggering build for ${jobId}`);

          // Calculate release date based on complexity
          const features2: string[] = features;
          const pages: string[] = Array.isArray(job?.userInput?.pages) ? job.userInput.pages : [];
          const siteType = job?.userInput?.siteType || "single";
          let releaseDays = 10;
          if (siteType === "multi" || pages.length > 3) releaseDays += 1;
          if (features2.length > 3) releaseDays += 1;
          releaseDays = Math.min(releaseDays, 12);
          const releaseAt = new Date(Date.now() + releaseDays * 24 * 60 * 60 * 1000).toISOString();

          await saveJob(jobId, {
            ...job,
            status: "building",
            metadata: {
              ...(job?.metadata || {}),
              autoTriggeredAt: new Date().toISOString(),
              scheduledReleaseAt: releaseAt,
              scheduledReleaseDays: releaseDays,
            },
          });

          // Trigger Inngest build pipeline
          const { inngest: inngestClient } = await import("@/lib/inngest");
          await inngestClient.send({ name: "build/website", data: { jobId } });

          // Notify owner that build started automatically
          await resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: process.env.RESULT_TO_EMAIL!,
            subject: `🚀 Auto-build started — ${job?.userInput?.businessName || jobId}`,
            html: [
              "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;'>",
              "<h1 style='color:#00c896;'>🚀 Build Started Automatically</h1>",
              "<p style='color:#94a3b8;'>Deposit received. No booking system selected — build triggered automatically.</p>",
              "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Business</td><td style='color:#e2e8f0;font-weight:600;'>" + (job?.userInput?.businessName || "—") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Industry</td><td style='color:#e2e8f0;'>" + (job?.userInput?.industry || "—") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Features</td><td style='color:#e2e8f0;'>" + (features.join(", ") || "None") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Auto-release in</td><td style='color:#10b981;font-weight:600;'>" + releaseDays + " days (" + new Date(releaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) + ")</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Job ID</td><td style='color:#475569;font-size:12px;'>" + jobId + "</td></tr>",
              "</table>",
              "<p style='color:#94a3b8;font-size:14px;'>The site will be built in the next few minutes and auto-released to the client on the date above. You'll receive a build completion email with smoke test results.</p>",
              "<a href='" + base + "/admin' style='display:inline-block;background:#00c896;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:16px;'>📊 Open Admin Dashboard →</a>",
              "</div>",
            ].join(""),
          });

        } else {
          // ── BOOKING REQUESTED: notify admin — Step 0 auto-creates SuperSaas
          // schedule, but admin should verify it looks right before the build
          // completes. Admin can trigger rebuild from admin panel if needed.
          console.log(`[Payment] Booking feature selected — notifying admin for ${jobId}`);

          // Still auto-trigger the build — Step 0 creates the SuperSaas schedule automatically.
          // Admin is notified to verify the schedule, not to block the build.
          const { inngest: inngestClient } = await import("@/lib/inngest");
          await inngestClient.send({ name: "build/website", data: { jobId } });

          const adminUrl = `${base}/admin`;
          await resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: process.env.RESULT_TO_EMAIL!,
            subject: `📅 Build started (verify booking) — ${job?.userInput?.businessName || jobId}`,
            html: [
              "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;'>",
              "<h1 style='color:#00c896;'>📅 Build Started — Booking Included</h1>",
              "<p style='color:#94a3b8;'>Deposit received. Build triggered automatically. SuperSaas schedule was created in Step 0 — please verify it looks right.</p>",
              "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Business</td><td style='color:#e2e8f0;font-weight:600;'>" + (job?.userInput?.businessName || "—") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Client Email</td><td style='color:#e2e8f0;'>" + (job?.userInput?.email || "—") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Services</td><td style='color:#e2e8f0;'>" + (job?.userInput?.bookingServices || "auto-generated from industry") + "</td></tr>",
              "</table>",
              "<div style='background:#0c1a0e;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:16px 20px;margin:20px 0;'>",
              "<p style='color:#10b981;font-weight:700;margin:0 0 8px;'>✅ Build is running automatically</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0;'>SuperSaas schedule was auto-created in pipeline Step 0. Please log into SuperSaas and verify the schedule has the right services and availability. You can trigger a rebuild from the admin panel if anything needs adjusting.</p>",
              "</div>",
              "<a href='" + adminUrl + "' style='display:inline-block;background:#00c896;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;'>📊 Open Admin Dashboard →</a>",
              "</div>",
            ].join(""),
          });
          console.log(`[Payment] Booking build auto-started for ${jobId} — admin notified to verify SuperSaas schedule`);
        }
      } catch (e) { console.error("Failed to handle deposit event:", e); }
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
