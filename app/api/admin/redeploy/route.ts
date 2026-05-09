// Redeploys the currently stored HTML for a job directly to Vercel — no fix pass, no rebuild.
import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob, getClient, saveClient, appendPipelineLog } from "@/lib/db";
import { isAdminAuthed, isAdminAuthedLegacy } from "@/lib/admin-auth";

async function deployToVercel(html: string, projectName: string): Promise<string> {
  const safeName = projectName.slice(0, 52);
  const resp = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeName,
      teamId: process.env.VERCEL_TEAM_ID || undefined,
      files: [{ file: "index.html", data: html, encoding: "utf-8" }],
      projectSettings: { framework: null, outputDirectory: "./" },
    }),
  });
  if (!resp.ok) throw new Error(`Vercel deploy failed: ${await resp.text()}`);
  return `https://${safeName}.vercel.app`;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req) && !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.html || job.html.length < 1000) {
    return NextResponse.json({ error: `No stored HTML (${job.html?.length ?? 0} chars)` }, { status: 400 });
  }

  const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);
  const previewUrl = await deployToVercel(job.html, vercelProjectName);
  const now = new Date().toISOString();

  await saveJob(jobId, { ...job, previewUrl, builtAt: now, fixedAt: now });
  if (job.clientSlug) {
    const client = await getClient(job.clientSlug);
    if (client) await saveClient(job.clientSlug, { ...client, preview_url: previewUrl });
  }
  await appendPipelineLog(jobId, { level: "info", step: "force_redeploy", msg: `Force-redeployed stored HTML → ${previewUrl}`, businessName: job.userInput?.businessName });

  return NextResponse.json({ ok: true, previewUrl });
}
