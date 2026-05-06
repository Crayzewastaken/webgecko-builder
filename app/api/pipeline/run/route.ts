// app/api/pipeline/run/route.ts
// Triggers the Inngest build pipeline. Returns immediately — Inngest handles execution.

export const maxDuration = 30;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function runPipeline(jobId: string, fullRebuild = false): Promise<{ success: boolean; error?: string }> {
  if (fullRebuild) {
    // Clear cached HTML so the pipeline runs Stitch from scratch
    const job = await getJob(jobId);
    if (job) await saveJob(jobId, { ...job, html: null, status: "pending" });
  }
  // runId busts Inngest's event deduplication so steps never replay from cache
  await inngest.send({ name: "build/website", data: { jobId, isRebuild: !fullRebuild, runId: Date.now() } });
  return { success: true };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || searchParams.get("id");
  const secret = searchParams.get("secret");
  const fullRebuild = searchParams.get("fullRebuild") === "true";

  if (!jobId || secret !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;">
        <h1 style="color:#ef4444">❌ Job Not Found</h1><p>No job with ID: ${jobId}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Full rebuild: wipe cached HTML so Stitch runs fresh, never replays old steps
  if (fullRebuild && job) {
    await saveJob(jobId, { ...job, html: null, status: "pending" });
  }
  await inngest.send({ name: "build/website", data: { jobId, isRebuild: !fullRebuild, runId: Date.now() } });

  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;">
      <h1 style="color:#22c55e">✅ Build Queued</h1>
      <p>Pipeline started for: <strong>${job.userInput?.businessName || jobId}</strong></p>
      <p style="color:#94a3b8;font-size:14px;">${fullRebuild ? "⚡ Full rebuild — Stitch will regenerate the design from scratch." : "🔧 Fast rebuild — reusing existing design, re-running fixes only."}</p>
      <p style="color:#94a3b8;font-size:14px;">Inngest will run each step independently. You'll receive an email when complete (typically 5–10 minutes).</p>
      <p style="color:#475569;font-size:12px;margin-top:24px;">Job ID: ${jobId}</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { jobId, secret, fullRebuild } = body;

  const hasAdminSecret = secret === process.env.PROCESS_SECRET;
  // Only admins can trigger a full rebuild (hits Stitch again)
  if (fullRebuild && !hasAdminSecret) {
    return NextResponse.json({ error: "Forbidden: fullRebuild requires admin secret" }, { status: 403 });
  }

  let hasClientAuth = false;
  if (!hasAdminSecret && jobId) {
    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    if (sessionSlug) {
      const { data } = await supabase
        .from("clients")
        .select("job_id")
        .eq("slug", sessionSlug)
        .single();
      hasClientAuth = data?.job_id === jobId;
    }
  }

  if (!jobId || (!hasAdminSecret && !hasClientAuth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Full rebuild: wipe cached HTML so Stitch runs fresh
  if (fullRebuild) {
    const jobForReset = await getJob(jobId);
    if (jobForReset) await saveJob(jobId, { ...jobForReset, html: null, status: "pending" });
  }
  await inngest.send({ name: "build/website", data: { jobId, isRebuild: !fullRebuild, runId: Date.now() } });
  return NextResponse.json({ success: true, queued: true, jobId, fullRebuild: !!fullRebuild });
}
