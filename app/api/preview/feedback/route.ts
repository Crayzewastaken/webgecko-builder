// app/api/preview/feedback/route.ts
// Client submits change requests. When they hit "Submit for Revision", we email the owner
// with the full list — the owner applies them manually and re-releases.
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getClient, saveFeedback } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY!);

// POST — submit a single feedback comment
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const body = await req.json();
  const { text } = body;
  if (!text?.trim()) return NextResponse.json({ error: "Empty feedback" }, { status: 400 });

  const client = await getClient(slug);
  if (!client?.job_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await saveFeedback(client.job_id, { message: text.trim(), clientSlug: slug });

  // Return all feedback for this job (shape: {id, text, createdAt} for portal compatibility)
  const { data: allFeedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("job_id", client.job_id)
    .order("created_at", { ascending: true });

  const mapped = (allFeedback || []).map((f: any) => ({ id: f.id, text: f.message, createdAt: f.created_at }));
  return NextResponse.json({ success: true, feedback: mapped });
}

// GET — retrieve feedback
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const client = await getClient(slug);
  if (!client?.job_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("job_id", client.job_id)
    .order("created_at", { ascending: true });

  const mapped = (feedback || []).map((f: any) => ({ id: f.id, text: f.message, createdAt: f.created_at }));
  return NextResponse.json({ feedback: mapped, round: 1 });
}

// DELETE — client submits their change list for revision (emails owner)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const client = await getClient(slug);
  if (!client?.job_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = client.job_id;

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (!feedback || feedback.length === 0) {
    return NextResponse.json({ error: "No feedback to submit" }, { status: 400 });
  }

  // Clear feedback after submission
  await supabase.from("feedback").delete().eq("job_id", jobId);

  const base = "https://webgecko-builder.vercel.app";
  const processSecret = process.env.PROCESS_SECRET || "";
  const releaseUrl = `${base}/api/unlock/release?jobId=${jobId}&secret=${encodeURIComponent(processSecret)}`;
  const fixUrl = `${base}/api/admin/fix-proxy?jobId=${jobId}&secret=${encodeURIComponent(processSecret)}`;
  const adminUrl = `${base}/admin?secret=${encodeURIComponent(processSecret)}`;

  const feedbackHtml = feedback
    .map((f: any, i: number) => `<tr><td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;vertical-align:top;width:24px;font-weight:700;">${i + 1}.</td><td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:14px;">${f.message}</td></tr>`)
    .join("");

  try {
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `✏️ Change Request — ${(client as any).business_name || slug}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:32px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">Client Change Request</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">${(client as any).business_name || slug}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;">Apply these changes to the site HTML, then click <strong style="color:#00c896;">Release Preview</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;border-radius:8px;margin-bottom:24px;">
      ${feedbackHtml}
    </table>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;"><a href="${releaseUrl}" style="background:#00c896;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📤 Release Preview</a></td>
      <td style="padding-right:8px;"><a href="${fixUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔧 Fix Site</a></td>
      <td><a href="${adminUrl}" style="background:#1e293b;color:#94a3b8;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📊 Admin</a></td>
    </tr></table>
  </td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (e) { console.error("[Feedback] Email failed:", e); }

  return NextResponse.json({ success: true });
}
