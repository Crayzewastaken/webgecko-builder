// app/api/unlock/release/route.ts
// Owner clicks "Release to Client" — emails them the portal link.
import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getJob, saveJob } from "@/lib/db";

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

    // Mark preview as unlocked
    await saveJob(jobId, { ...job, previewUnlocked: true, previewUnlockedAt: new Date().toISOString() });

    const clientSlug = job.clientSlug || "";
    const clientEmail = job.userInput?.email || "";
    const businessName = job.userInput?.businessName || "your website";
    const portalUrl = `https://webgecko-builder.vercel.app/c/${clientSlug}`;

    if (clientEmail) {
      try {
        await resend.emails.send({
          from: "WebGecko <hello@webgecko.au>",
          to: clientEmail,
          subject: `Your Website Preview is Ready — ${businessName}`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#00c896,#0099ff);padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;">Your Website Preview is Ready!</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="color:#e2e8f0;margin:0 0 16px;">Your website for <strong style="color:#00c896;">${businessName}</strong> has been built and is ready for your review.</p>
    <p style="color:#e2e8f0;margin:0 0 24px;">Log in to your client portal to view the preview and leave feedback.</p>
    <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#00c896,#0099ff);color:#000;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;">View Your Website Preview</a>
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="color:#475569;font-size:12px;margin:0;">Sent by WebGecko · hello@webgecko.au</p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
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
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#0f0f0f;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:48px;max-width:480px;text-align:center;">
<p style="color:${color};font-size:16px;margin:0;">${message}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html" }, status }
  );
}
