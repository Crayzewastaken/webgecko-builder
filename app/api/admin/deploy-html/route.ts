import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob, getClient, saveClient } from "@/lib/db";
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

  const form = await req.formData();
  const jobId = form.get("jobId") as string | null;
  const file = form.get("file") as File | null;

  if (!jobId || !file) {
    return NextResponse.json({ error: "Missing jobId or file" }, { status: 400 });
  }

  const html = await file.text();
  if (html.length < 100 || !html.includes("<")) {
    return NextResponse.json({ error: "File does not appear to be valid HTML" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);

  const previewUrl = await deployToVercel(html, vercelProjectName);
  const now = new Date().toISOString();

  await saveJob(jobId, { ...job, html, previewUrl, builtAt: now, fixedAt: now });

  if (job.clientSlug) {
    const client = await getClient(job.clientSlug);
    if (client) await saveClient(job.clientSlug, { ...client, preview_url: previewUrl });
  }

  return NextResponse.json({ ok: true, previewUrl });
}
