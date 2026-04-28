// app/api/preview/feedback/route.ts
// Client submits feedback comments on their preview. After 10 comments (or manual trigger),
// the feedback is sent to Claude to revise the site HTML, then owner gets an email.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface FeedbackItem {
  id: string;
  text: string;
  createdAt: string;
  round: number;
}

// POST — submit feedback comment
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

// DELETE — trigger revision (owner or auto after 10 comments)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const client = await redis.get<any>("client:" + slug);
  if (!client?.jobId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = client.jobId;
  const job = await redis.get<any>("job:" + jobId);
  if (!job?.html) return NextResponse.json({ error: "No site HTML found" }, { status: 404 });

  const feedbackKey = "feedback:" + jobId;
  const feedback: FeedbackItem[] = (await redis.get<FeedbackItem[]>(feedbackKey)) || [];
  if (feedback.length === 0) return NextResponse.json({ error: "No feedback to apply" }, { status: 400 });

  const feedbackText = feedback.map((f, i) => (i + 1) + ". " + f.text).join("\n");

  // Apply feedback with Claude Sonnet
  const revisionPrompt = "You are a precise HTML editor. Apply the client feedback below to the website HTML. " +
    "Make ONLY the changes described. Preserve all existing structure, styling, and Tailwind classes. " +
    "Return the COMPLETE revised HTML document with no explanation, no markdown, no backticks.\n\n" +
    "CLIENT FEEDBACK:\n" + feedbackText + "\n\n" +
    "CURRENT HTML:\n" + job.html.substring(0, 80000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    messages: [{ role: "user", content: revisionPrompt }],
  });

  let revisedHtml = response.content[0]?.type === "text" ? response.content[0].text : "";
  revisedHtml = revisedHtml.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!revisedHtml || !revisedHtml.includes("<html") && !revisedHtml.includes("<!DOCTYPE")) {
    return NextResponse.json({ error: "Revision failed — Claude returned invalid HTML" }, { status: 500 });
  }

  // Save revised HTML
  const round = ((await redis.get<number>("feedback:round:" + jobId)) || 1) + 1;
  await redis.set("job:" + jobId, { ...job, html: revisedHtml, revisedAt: new Date().toISOString() }, { ex: 86400 * 30 });
  await redis.set("feedback:" + jobId, []);
  await redis.set("feedback:round:" + jobId, round);

  // Email owner
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
  const processSecret = process.env.PROCESS_SECRET || "";
  const releaseUrl = base + "/api/unlock/release?jobId=" + jobId + "&secret=" + encodeURIComponent(processSecret);
  const unlockUrl = base + "/api/payment/unlock?jobId=" + jobId + "&secret=" + encodeURIComponent(processSecret);
  const adminUrl = base + "/admin?secret=" + encodeURIComponent(processSecret);

  try {
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: "🔄 Site Revised — " + (client.businessName || slug) + " (Round " + round + ")",
      html: "<h2>Site Revision Complete — Round " + round + "</h2>" +
        "<p><strong>Client:</strong> " + (client.businessName || slug) + "</p>" +
        "<p><strong>Feedback applied:</strong></p><ol>" +
        feedback.map(f => "<li>" + f.text + "</li>").join("") + "</ol>" +
        "<p>Preview the revised site and release it to the client for another review round, or unlock final payment if it's ready.</p>" +
        "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;'>" +
        "<a href='" + releaseUrl + "' style='background:#00c896;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;'>📤 Release to Client</a>" +
        "<a href='" + unlockUrl + "' style='background:#8b5cf6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;'>🔓 Unlock Final Payment</a>" +
        "<a href='" + adminUrl + "' style='background:#1e293b;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;'>📊 Admin Dashboard</a>" +
        "</div>",
    });
  } catch (e) { console.error("Revision email failed:", e); }

  return NextResponse.json({ success: true, round });
}
