// app/api/admin/reset-job/route.ts
// Force-reset a stuck "building" job status, optionally rolling back to last good HTML
import { NextRequest } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { inngest } from "@/lib/inngest";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobId, action } = body;

  // Accept cookie-based session OR legacy secret in body
  if (!isAdminAuthed(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!jobId || !action) {
    return Response.json({ error: "Missing jobId or action" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  if (action === "rollback") {
    const lastHtml = job.metadata?.lastGoodHtml;
    const lastUrl  = job.metadata?.lastGoodUrl;
    if (!lastHtml) return Response.json({ error: "No rollback snapshot available" }, { status: 400 });

    await saveJob(jobId, {
      ...job,
      html: lastHtml,
      previewUrl: lastUrl || job.previewUrl,
      status: "completed",
      metadata: { ...(job.metadata || {}), rolledBackAt: new Date().toISOString() },
    });
    return Response.json({ ok: true, message: "Rolled back to last good build" });
  }

  // reset-and-rebuild: clear building lock AND wipe cached HTML so Stitch runs fresh
  if (action === "reset-and-rebuild") {
    await saveJob(jobId, { ...job, html: null, status: "pending" });
    await inngest.send({
      name: "build/website",
      data: { jobId, isRebuild: true, runId: Date.now() },
    });
    return Response.json({ ok: true, message: "Status reset and full rebuild queued from scratch" });
  }

  // plain reset: just clear the lock
  await saveJob(jobId, { ...job, status: "completed" });
  return Response.json({ ok: true, message: "Job status reset to completed" });
}
