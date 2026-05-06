// app/api/contact/route.ts
// Client submits a support/contact request → emailed to hello@webgecko.au
import { NextRequest } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const TOPIC_LABELS: Record<string, string> = {
  change_request:  "Change to site",
  billing:         "Billing / payment",
  technical_issue: "Technical issue",
  booking_setup:   "Booking system help",
  domain_dns:      "Domain / DNS",
  new_feature:     "Add something new",
  launch:          "Ready to launch",
  other:           "Other",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, businessName, email, topics, details } = body;

  if (!details?.trim() && (!topics || topics.length === 0)) {
    return Response.json({ error: "No content" }, { status: 400 });
  }

  const topicLines = (topics || [])
    .map((t: string) => `• ${TOPIC_LABELS[t] || t}`)
    .join("\n");

  const subject = `[WebGecko Support] ${businessName || slug} — ${
    topics?.length ? TOPIC_LABELS[topics[0]] || topics[0] : "Contact request"
  }`;

  const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;font-size:18px;">New support request from <strong>${businessName || slug}</strong></h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
    <tr><td style="padding:6px 12px 6px 0;color:#666;width:120px;">Client slug</td><td style="padding:6px 0;font-weight:600;">${slug}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#666;">Email</td><td style="padding:6px 0;">${email || "—"}</td></tr>
  </table>
  ${topicLines ? `<p style="font-size:13px;color:#444;margin:0 0 6px;font-weight:600;">Topics:</p><pre style="font-size:13px;background:#f4f4f5;border-radius:6px;padding:10px 14px;margin:0 0 20px;">${topicLines}</pre>` : ""}
  ${details?.trim() ? `<p style="font-size:13px;color:#444;margin:0 0 6px;font-weight:600;">Details:</p><div style="background:#f4f4f5;border-radius:6px;padding:12px 14px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${details.trim()}</div>` : ""}
  <p style="font-size:12px;color:#999;margin-top:24px;">Sent from the WebGecko client portal · /c/${slug}</p>
</div>`;

  try {
    await resend.emails.send({
      from: "WebGecko Portal <noreply@webgecko.au>",
      to: "hello@webgecko.au",
      replyTo: email || undefined,
      subject,
      html,
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("Contact email failed:", err);
    return Response.json({ error: "Failed to send" }, { status: 500 });
  }
}
