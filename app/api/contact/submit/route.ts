// app/api/contact/submit/route.ts
// Receives contact form submissions from deployed client websites.
// Emails the client business owner and forwards a copy to WebGecko.

import { NextRequest } from "next/server";
import { Resend } from "resend";
import { getJob, trackAnalyticsEvent } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, name, email, phone, message } = await req.json();

    if (!jobId || !name || !email) {
      return Response.json({ ok: false, error: "Missing required fields" }, { status: 400, headers: CORS });
    }

    const job = await getJob(jobId);
    if (!job) {
      return Response.json({ ok: false, error: "Job not found" }, { status: 404, headers: CORS });
    }

    const businessName = job.userInput?.businessName || "Your Website";
    const clientEmail = job.userInput?.email || "";

    // Track in analytics
    await trackAnalyticsEvent(jobId, "form_submit").catch(() => {});

    const clientHtml = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;background:#f9fafb;padding:32px;border-radius:12px;color:#111;">
  <h2 style="margin:0 0 4px;font-size:20px;color:#111;">New enquiry from your website</h2>
  <p style="color:#666;margin:0 0 24px;font-size:14px;">${businessName}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:12px 16px;color:#6b7280;width:100px;white-space:nowrap;">Name</td>
      <td style="padding:12px 16px;font-weight:600;">${name}</td>
    </tr>
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:12px 16px;color:#6b7280;">Email</td>
      <td style="padding:12px 16px;"><a href="mailto:${email}" style="color:#2563eb;">${email}</a></td>
    </tr>
    ${phone ? `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:12px 16px;color:#6b7280;">Phone</td><td style="padding:12px 16px;"><a href="tel:${phone}" style="color:#2563eb;">${phone}</a></td></tr>` : ""}
    ${message ? `<tr><td style="padding:12px 16px;color:#6b7280;vertical-align:top;">Message</td><td style="padding:12px 16px;white-space:pre-wrap;">${message}</td></tr>` : ""}
  </table>
  <p style="margin-top:24px;font-size:13px;color:#9ca3af;">Submitted via your WebGecko website. Reply directly to this email to respond to ${name}.</p>
</div>`;

    const wgHtml = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;padding:24px;color:#111;">
  <h2 style="margin:0 0 4px;font-size:16px;">[Lead] ${businessName}</h2>
  <p style="color:#666;margin:0 0 16px;font-size:12px;">jobId: ${jobId}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
    <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 12px;color:#6b7280;width:80px;">Name</td><td style="padding:8px 12px;font-weight:600;">${name}</td></tr>
    <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 12px;color:#6b7280;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
    ${phone ? `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 12px;color:#6b7280;">Phone</td><td style="padding:8px 12px;">${phone}</td></tr>` : ""}
    ${message ? `<tr><td style="padding:8px 12px;color:#6b7280;vertical-align:top;">Message</td><td style="padding:8px 12px;white-space:pre-wrap;">${message}</td></tr>` : ""}
  </table>
</div>`;

    const sends: Promise<any>[] = [];

    if (clientEmail) {
      sends.push(resend.emails.send({
        from: "WebGecko Leads <noreply@webgecko.au>",
        to: clientEmail,
        replyTo: email,
        subject: `New enquiry from ${name} — ${businessName}`,
        html: clientHtml,
      }));
    }

    if (process.env.RESULT_TO_EMAIL) {
      sends.push(resend.emails.send({
        from: "WebGecko <noreply@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL,
        subject: `[Lead] ${businessName} — ${name}`,
        html: wgHtml,
      }));
    }

    await Promise.allSettled(sends);

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("[contact/submit] Error:", err);
    return Response.json({ ok: false, error: "Failed to send" }, { status: 500, headers: CORS });
  }
}
