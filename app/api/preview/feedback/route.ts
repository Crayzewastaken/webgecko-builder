// app/api/preview/feedback/route.ts
// Client submits change requests. When they hit "Submit for Revision", we email the owner
// with the full list — the owner applies them manually and re-releases.
// We do NOT pass the HTML through an AI model (risks truncation and redesign).
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

export interface FeedbackItem {
  id: string;
  text: string;
  createdAt: string;
  round: number;
}

// POST — submit a single feedback comment
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const body = await req.json();
  const { text } = body;
  if (!text?.trim()) return NextResponse.json({ error: "Empty feedback" }, { status: 400 });

  const client = await redis.get<any>("client:" + slug);
  if (!client?.jobId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedbackKey = "feedback:" + client.jobId;
  const existing: FeedbackItem[] = (await redis.get<FeedbackItem[]>(feedbackKey)) || [];
  const round = (await redis.get<number>("feedback:round:" + client.jobId)) || 1;

  const item: FeedbackItem = {
    id: Date.now().toString(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    round,
  };
  const updated = [...existing, item];
  await redis.set(feedbackKey, updated);

  return NextResponse.json({ success: true, feedback: updated });
}

// GET — retrieve feedback
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const client = await redis.get<any>("client:" + slug);
  if (!client?.jobId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedbackKey = "feedback:" + client.jobId;
  const feedback: FeedbackItem[] = (await redis.get<FeedbackItem[]>(feedbackKey)) || [];
  const round = (await redis.get<number>("feedback:round:" + client.jobId)) || 1;

  return NextResponse.json({ feedback, round });
}

// DELETE — client submits their change list for revision
// This emails the owner with the full list. No AI touches the HTML.
// The owner applies the changes manually and clicks "Release Preview" again.
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const client = await redis.get<any>("client:" + slug);
  if (!client?.jobId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = client.jobId;
  const feedbackKey = "feedback:" + jobId;
  const feedback: FeedbackItem[] = (await redis.get<FeedbackItem[]>(feedbackKey)) || [];
  if (feedback.length === 0) return NextResponse.json({ error: "No feedback to submit" }, { status: 400 });

  // Increment round counter and clear the feedback list
  const round = ((await redis.get<number>("feedback:round:" + jobId)) || 1) + 1;
  await redis.set("feedback:" + jobId, []);
  await redis.set("feedback:round:" + jobId, round);

  // Email owner with the change list so they can apply it manually
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au";
  const processSecret = process.env.PROCESS_SECRET || "";
  const releaseUrl = `${base}/api/unlock/release?jobId=${jobId}&secret=${encodeURIComponent(processSecret)}`;
  const fixUrl = `${base}/api/fix?jobId=${jobId}&secret=${encodeURIComponent(processSecret)}`;
  const adminUrl = `${base}/admin?secret=${encodeURIComponent(processSecret)}`;

  const feedbackHtml = feedback
    .map((f, i) => `<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;vertical-align:top;width:24px;font-weight:700;">${i + 1}.</td><td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:14px;">${f.text}</td></tr>`)
    .join("");

  try {
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `✏️ Change Request — ${client.businessName || slug} (Round ${round - 1})`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:32px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">Client Change Request</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">${client.businessName || slug} — Round ${round - 1} feedback</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;">Apply these changes to the site HTML, then click <strong style="color:#00c896;">Release Preview</strong> to send the updated version to the client.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;border-radius:8px;margin-bottom:24px;">
      ${feedbackHtml}
    </table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;"><a href="${releaseUrl}" style="background:#00c896;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📤 Release Preview</a></td>
      <td style="padding-right:8px;"><a href="${fixUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔧 Re-run Fix Pass</a></td>
      <td><a href="${adminUrl}" style="background:#1e293b;color:#94a3b8;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📊 Admin</a></td>
    </tr></table>
  </td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (e) { console.error("[Feedback] Email failed:", e); }

  return NextResponse.json({ success: true, round });
}
