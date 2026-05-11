// app/api/admin/fix-url/route.ts
// Force-update the saved preview_url for a job/client to the stable Vercel alias.
import { NextRequest } from "next/server";
import { getJob, saveJob, getClient, saveClient } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { jobId } = await req.json();
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);
  const stableUrl = `https://${vercelProjectName}.vercel.app`;

  await saveJob(jobId, { ...job, previewUrl: stableUrl });
  if (job.clientSlug) {
    const client = await getClient(job.clientSlug);
    if (client) await saveClient(job.clientSlug, { ...client, preview_url: stableUrl });
  }

  return Response.json({ ok: true, stableUrl, vercelProjectName });
}
