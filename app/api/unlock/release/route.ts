// app/api/unlock/release/route.ts
// Owner clicks "Release to Client" — emails them the portal link.
import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getJob, saveJob, getPaymentState, savePaymentState } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret || secret !== process.env.PROCESS_SECRET) {
    return page("Unauthorized", "#ef4444", 403);
  }

  try {
    const job = await getJob(jobId);
    if (!job) return page("Job not found", "#ef4444", 404);

    // Mark preview as unlocked — update BOTH jobs (for reference) and payment_state (which the portal reads)
    await saveJob(jobId, { ...job, previewUnlocked: true, previewUnlockedAt: new Date().toISOString() });
    const existingPs = await getPaymentState(jobId) || {};
    await savePaymentState(jobId, {
      ...existingPs,
      previewUnlocked: true,
      previewUnlockedAt: new Date().toISOString(),
    });

    const clientSlug = job.clientSlug || "";
    const clientEmail = job.userInput?.email || "";
    const businessName = job.userInput?.businessName || "your website";
    const portalUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app") + "/c/" + clientSlug;

    // SuperSaas sub-account — include login info if sub-user email is known.
    // Password is intentionally NOT stored in job metadata (security policy).
    // The client received their password in the original intake email at sign-up.
    const ssSubEmail = (job as any).metadata?.supersaasSubEmail || "";
    const ssScheduleUrl = job.supersaasUrl
      ? job.supersaasUrl.split("?")[0]  // plain URL without any credential params
      : "";

    const bookingSection = (ssSubEmail && ssScheduleUrl) ? [
      '<tr><td style="padding:0 32px 24px;">',
      '<div style="background:#0a1628;border:1px solid rgba(0,200,150,0.25);border-radius:10px;padding:20px 24px;">',
      '<p style="margin:0 0 8px;color:#00c896;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">📅 Your Booking System</p>',
      '<p style="margin:0 0 4px;color:#94a3b8;font-size:13px;">Your clients book directly on your website. You can also manage bookings at SuperSaas:</p>',
      '<table style="margin:12px 0;width:100%;" cellpadding="0" cellspacing="0">',
      '<tr><td style="padding:4px 0;color:#64748b;font-size:12px;width:80px;">Login URL</td><td style="padding:4px 0;"><a href="https://www.supersaas.com/account/login" style="color:#38bdf8;font-size:13px;">supersaas.com/account/login</a></td></tr>',
      '<tr><td style="padding:4px 0;color:#64748b;font-size:12px;">Username</td><td style="padding:4px 0;color:#e2e8f0;font-size:13px;font-weight:600;">' + ssSubEmail + '</td></tr>',
      '<tr><td style="padding:4px 0;color:#64748b;font-size:12px;">Password</td><td style="padding:4px 0;color:#94a3b8;font-size:13px;">Sent separately at sign-up</td></tr>',
      '</table>',
      '<p style="margin:8px 0 0;color:#475569;font-size:11px;">You\'ll only see your own bookings. Contact support if you need a password reset.</p>',
      '</div></td></tr>',
    ].join("") : "";

    if (clientEmail) {
      try {
        const emailHtml = [
          '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">',
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">',
          '<table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">',
          '<tr><td style="background:linear-gradient(135deg,#00c896,#0099ff);padding:28px 32px;">',
          '<h1 style="margin:0;color:#fff;font-size:22px;">Your Website Preview is Ready!</h1>',
          '</td></tr>',
          '<tr><td style="padding:32px 32px 20px;">',
          '<p style="color:#e2e8f0;margin:0 0 16px;">Your website for <strong style="color:#00c896;">' + businessName + '</strong> has been built and is ready for your review.</p>',
          '<p style="color:#e2e8f0;margin:0 0 24px;">Log in to your client portal to view the preview, manage your bookings, and leave feedback.</p>',
          '<a href="' + portalUrl + '" style="display:inline-block;background:linear-gradient(135deg,#00c896,#0099ff);color:#000;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;">View Your Website Portal</a>',
          '</td></tr>',
          bookingSection,
          '<tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">',
          '<p style="color:#475569;font-size:12px;margin:0;">Sent by WebGecko · hello@webgecko.au · Reply any time if you need help.</p>',
          '</td></tr>',
          '</table></td></tr></table>',
          '</body></html>',
        ].join("");

        await resend.emails.send({
          from: "WebGecko <hello@webgecko.au>",
          to: clientEmail,
          subject: "Your Website Preview is Ready — " + businessName,
          html: emailHtml,
        });
      } catch (e) { console.error("Release email failed:", e); }
    }

    return page("Site released — client has been notified by email.", "#00c896");
  } catch (e) {
    console.error("Release unlock failed:", e);
    return page("Failed to unlock preview.", "#ef4444", 500);
  }
}

function page(message: string, color: string, status = 200) {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;background:#0f0f0f;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">' +
    '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:48px;max-width:480px;text-align:center;">' +
    '<p style="color:' + color + ';font-size:16px;margin:0;">' + message + '</p>' +
    '</div></body></html>',
    { headers: { "Content-Type": "text/html" }, status }
  );
}
