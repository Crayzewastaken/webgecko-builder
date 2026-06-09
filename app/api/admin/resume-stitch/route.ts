// app/api/admin/resume-stitch/route.ts
// Receives the manually-generated Stitch HTML from the admin, saves it to the
// job's metadata, then fires the Inngest resume event so the pipeline continues.

import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { isAdminAuthed, isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req) && !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let jobId: string = "";
  let html: string = "";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // File upload path
    const formData = await req.formData();
    jobId = (formData.get("jobId") as string) || "";
    const file = formData.get("html") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    html = await file.text();
  } else {
    // JSON path (paste HTML as string)
    const body = await req.json().catch(() => ({}));
    jobId = body.jobId || "";
    html = body.html || "";
  }

  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!html || html.length < 500) {
    return NextResponse.json({ error: `HTML too short (${html?.length ?? 0} chars)` }, { status: 400 });
  }
  if (!html.toLowerCase().includes("<body")) {
    return NextResponse.json({ error: "Uploaded content does not look like valid HTML" }, { status: 400 });
  }

  const job = await getJob(jobId) as any;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.buildStatus !== "awaiting_stitch") {
    return NextResponse.json({
      error: `Job is not awaiting Stitch (current status: ${job.buildStatus}). It may have already been resumed or never paused.`
    }, { status: 409 });
  }

  // Save the HTML into the job's metadata — the pipeline reads it on resume
  await saveJob(jobId, {
    ...job,
    buildStatus: "building",
    metadata: {
      ...(job.metadata || {}),
      pendingStitchHtml: html,
      stitchUploadedAt: new Date().toISOString(),
      stitchHtmlLength: html.length,
    },
  });

  // Fire the Inngest event — this unblocks the step.waitForEvent in the pipeline
  await inngest.send({
    name: "webgecko/stitch.html.uploaded",
    data: { jobId },
  });

  console.log(`[resume-stitch] Resumed jobId=${jobId} with ${html.length} chars of HTML`);

  return NextResponse.json({
    ok: true,
    jobId,
    htmlLength: html.length,
    message: "Pipeline resumed — site will be built and deployed shortly",
  });
}
