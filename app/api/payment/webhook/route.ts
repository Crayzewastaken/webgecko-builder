// app/api/payment/webhook/route.ts
// Square sends payment events here. Must be a raw body handler.
import { NextRequest, NextResponse } from "next/server";
import { verifySquareWebhook } from "@/lib/square";
import { getJob, saveJob, getPaymentState, savePaymentState, getClient, saveClient } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app"}/api/payment/webhook`;
  const isValid = await verifySquareWebhook(rawBody, signatureHeader, webhookUrl);

  if (!isValid) {
    console.error("Square webhook: invalid signature -- request rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const eventType: string = event.type || "";
  console.log(`Square webhook received: ${eventType}`);

  // Square checkout links fire "payment.created" (status=COMPLETED), not "payment.completed".
  // We handle all three as fallbacks; the status check below deduplicates partial updates.
  if (
    eventType === "payment.created" ||
    eventType === "payment.completed" ||
    eventType === "payment.updated"
  ) {
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

    // Deduplicate: if already marked paid, skip
    if (payments[stage]?.status === "paid") {
      console.log(`[Payment] Already marked paid: jobId=${jobId} stage=${stage} -- skipping`);
      return NextResponse.json({ ok: true });
    }

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

    // On deposit -- auto-build immediately
    if (stage === "deposit") {
      try {
        const job = await getJob(jobId);
        const features: string[] = Array.isArray(job?.userInput?.features) ? job.userInput.features : [];
        const hasBooking = features.includes("Booking System") || !!job?.hasBooking;
        const base = (process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app");
        const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY!);

        const clientEmail = job?.userInput?.email || "";
        const businessName = job?.userInput?.businessName || "your website";
        const clientSlug = job?.clientSlug || "";
        const portalUrl = `${base}/c/${clientSlug}`;

        // Email client: deposit receipt
        if (clientEmail) {
          resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: clientEmail,
            subject: `Deposit received - ${businessName}`,
            html: [
              "<!DOCTYPE html><html><body style='margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;'>",
              "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0a0f1a;padding:40px 20px;'><tr><td align='center'>",
              "<table width='600' cellpadding='0' cellspacing='0' style='background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);'>",
              "<tr><td style='background:linear-gradient(135deg,#00c896,#0099ff);padding:28px 32px;'>",
              "<h1 style='margin:0;color:#fff;font-size:22px;'>Deposit Received!</h1>",
              "</td></tr>",
              "<tr><td style='padding:32px 32px 24px;'>",
              "<p style='color:#e2e8f0;margin:0 0 16px;'>Thanks for your deposit, <strong style='color:#00c896;'>" + businessName + "</strong>.</p>",
              "<p style='color:#94a3b8;margin:0 0 24px;'>We have received your payment and your website build has started. We will be in touch shortly with a preview link.</p>",
              "<div style='background:#0a1628;border:1px solid rgba(0,200,150,0.2);border-radius:10px;padding:20px 24px;margin:0 0 24px;'>",
              "<p style='color:#00c896;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;'>What happens next</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0 0 8px;'>1. We build your site (usually within a few days)</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0 0 8px;'>2. You get a preview link to review everything</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0;'>3. Once you are happy, your site goes live</p>",
              "</div>",
              "<a href='" + portalUrl + "' style='display:inline-block;background:linear-gradient(135deg,#00c896,#0099ff);color:#000;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;'>View Your Client Portal</a>",
              "</td></tr>",
              "<tr><td style='padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);'>",
              "<p style='color:#475569;font-size:12px;margin:0;'>WebGecko - hello@webgecko.au - Reply any time with questions.</p>",
              "</td></tr>",
              "</table></td></tr></table>",
              "</body></html>",
            ].join(""),
          }).catch((e: any) => console.error("[Payment] Deposit receipt email failed:", e));
        }

        if (!hasBooking) {
          // FULLY AUTOMATED: trigger build immediately
          console.log(`[Payment] No booking feature -- auto-triggering build for ${jobId}`);

          const pages: string[] = Array.isArray(job?.userInput?.pages) ? job.userInput.pages : [];
          const siteType = job?.userInput?.siteType || "single";
          let releaseDays = 10;
          if (siteType === "multi" || pages.length > 3) releaseDays += 1;
          if (features.length > 3) releaseDays += 1;
          releaseDays = Math.min(releaseDays, 12);
          const releaseAt = new Date(Date.now() + releaseDays * 24 * 60 * 60 * 1000).toISOString();

          await saveJob(jobId, {
            ...job,
            metadata: {
              ...(job?.metadata || {}),
              autoTriggeredAt: new Date().toISOString(),
              scheduledReleaseAt: releaseAt,
              scheduledReleaseDays: releaseDays,
            },
          });

          const { inngest: inngestClient } = await import("@/lib/inngest");
          await inngestClient.send({ name: "build/website", data: { jobId } });

          await resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: process.env.RESULT_TO_EMAIL!,
            subject: `Auto-build started -- ${businessName}`,
            html: [
              "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;'>",
              "<h1 style='color:#00c896;'>Build Started Automatically</h1>",
              "<p style='color:#94a3b8;'>Deposit received. No booking system selected -- build triggered automatically.</p>",
              "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Business</td><td style='color:#e2e8f0;font-weight:600;'>" + businessName + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Industry</td><td style='color:#e2e8f0;'>" + (job?.userInput?.industry || "--") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Features</td><td style='color:#e2e8f0;'>" + (features.join(", ") || "None") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Auto-release in</td><td style='color:#10b981;font-weight:600;'>" + releaseDays + " days (" + new Date(releaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) + ")</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Job ID</td><td style='color:#475569;font-size:12px;'>" + jobId + "</td></tr>",
              "</table>",
              "<p style='color:#94a3b8;font-size:14px;'>The site will be built in the next few minutes and auto-released to the client on the date above.</p>",
              "<a href='" + base + "/admin' style='display:inline-block;background:#00c896;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:16px;'>Open Admin Dashboard</a>",
              "</div>",
            ].join(""),
          });

        } else {
          // BOOKING REQUESTED: auto-trigger build + notify admin to verify SuperSaas
          console.log(`[Payment] Booking feature selected -- auto-triggering build + notifying admin for ${jobId}`);

          const { inngest: inngestClient } = await import("@/lib/inngest");
          await inngestClient.send({ name: "build/website", data: { jobId } });

          await resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: process.env.RESULT_TO_EMAIL!,
            subject: `Build started (verify booking) -- ${businessName}`,
            html: [
              "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;'>",
              "<h1 style='color:#00c896;'>Build Started -- Booking Included</h1>",
              "<p style='color:#94a3b8;'>Deposit received. Build triggered automatically. SuperSaas schedule was created in Step 0 -- please verify it looks right.</p>",
              "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Business</td><td style='color:#e2e8f0;font-weight:600;'>" + businessName + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Client Email</td><td style='color:#e2e8f0;'>" + (clientEmail || "--") + "</td></tr>",
              "<tr><td style='color:#64748b;padding:8px 0;'>Services</td><td style='color:#e2e8f0;'>" + (job?.userInput?.bookingServices || "auto-generated from industry") + "</td></tr>",
              "</table>",
              "<div style='background:#0c1a0e;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:16px 20px;margin:20px 0;'>",
              "<p style='color:#10b981;font-weight:700;margin:0 0 8px;'>Build is running automatically</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0;'>SuperSaas schedule was auto-created in pipeline Step 0. Please log into SuperSaas and verify the schedule has the right services and availability.</p>",
              "</div>",
              "<a href='" + base + "/admin' style='display:inline-block;background:#00c896;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;'>Open Admin Dashboard</a>",
              "</div>",
            ].join(""),
          });
          console.log(`[Payment] Booking build auto-started for ${jobId} -- admin notified to verify SuperSaas schedule`);
        }
      } catch (e) { console.error("Failed to handle deposit event:", e); }
    }

    // Mark launch ready on final payment + email client that site is live
    if (stage === "final") {
      try {
        const job = await getJob(jobId);
        const clientEmail = job?.userInput?.email || "";
        const businessName = job?.userInput?.businessName || "your website";
        const clientSlug = job?.clientSlug || "";
        const base = process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app";
        const liveUrl = job?.liveUrl || job?.previewUrl || `${base}/c/${clientSlug}`;
        const portalUrl = `${base}/c/${clientSlug}`;

        if (job?.clientSlug) {
          const client = await getClient(job.clientSlug);
          if (client) await saveClient(job.clientSlug, { ...client, launch_ready: true });
        }

        if (clientEmail) {
          const resend = new (await import("resend")).Resend(process.env.RESEND_API_KEY!);
          resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: clientEmail,
            subject: `Your website is live! - ${businessName}`,
            html: [
              "<!DOCTYPE html><html><body style='margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;'>",
              "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0a0f1a;padding:40px 20px;'><tr><td align='center'>",
              "<table width='600' cellpadding='0' cellspacing='0' style='background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);'>",
              "<tr><td style='background:linear-gradient(135deg,#8b5cf6,#00c896);padding:28px 32px;'>",
              "<h1 style='margin:0;color:#fff;font-size:24px;'>Your website is LIVE!</h1>",
              "</td></tr>",
              "<tr><td style='padding:32px 32px 24px;'>",
              "<p style='color:#e2e8f0;font-size:16px;margin:0 0 16px;'>Congratulations, <strong style='color:#00c896;'>" + businessName + "</strong> is now live on the internet!</p>",
              "<p style='color:#94a3b8;margin:0 0 24px;'>Your site is up and ready to bring in customers. Here is where to find everything:</p>",
              "<div style='background:#0a1628;border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:20px 24px;margin:0 0 20px;'>",
              "<table style='width:100%;' cellpadding='0' cellspacing='0'>",
              "<tr><td style='color:#64748b;font-size:13px;padding:6px 0;width:120px;'>Your website</td><td><a href='" + liveUrl + "' style='color:#8b5cf6;font-size:14px;font-weight:600;'>" + liveUrl + "</a></td></tr>",
              "<tr><td style='color:#64748b;font-size:13px;padding:6px 0;'>Client portal</td><td><a href='" + portalUrl + "' style='color:#38bdf8;font-size:14px;'>" + portalUrl + "</a></td></tr>",
              "</table>",
              "</div>",
              "<div style='background:#0a1628;border:1px solid rgba(0,200,150,0.2);border-radius:10px;padding:20px 24px;margin:0 0 24px;'>",
              "<p style='color:#00c896;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;'>Tips to get started</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0 0 8px;'>Share your website link on social media and Google Business</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0 0 8px;'>Add your website to your email signature</p>",
              "<p style='color:#94a3b8;font-size:14px;margin:0;'>Log in to your portal any time to request updates or new features</p>",
              "</div>",
              "<a href='" + liveUrl + "' style='display:inline-block;background:linear-gradient(135deg,#8b5cf6,#00c896);color:#fff;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;'>Visit Your Live Website</a>",
              "</td></tr>",
              "<tr><td style='padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);'>",
              "<p style='color:#475569;font-size:12px;margin:0;'>WebGecko - hello@webgecko.au - Reply any time if you need help.</p>",
              "</td></tr>",
              "</table></td></tr></table>",
              "</body></html>",
            ].join(""),
          }).catch((e: any) => console.error("[Payment] Go-live email failed:", e));
        }
      } catch (e) { console.error("Failed to update launch status:", e); }
    }
  }

  return NextResponse.json({ ok: true });
}
