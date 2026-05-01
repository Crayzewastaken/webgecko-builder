// app/api/preview/proxy/route.ts
// Serves stored site HTML directly — bypasses X-Frame-Options on Vercel deployments.
import { NextRequest } from "next/server";
import { getJob, getClient } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  if (!jobId && !slug) return new Response("Missing params", { status: 400 });

  let html = "";
  if (jobId) {
    const job = await getJob(jobId);
    html = job?.html || "";
  } else if (slug) {
    const client = await getClient(slug!);
    if (client?.job_id) {
      const job = await getJob(client.job_id);
      html = job?.html || "";
    }
  }

  if (!html) return new Response("Site not ready yet", { status: 404 });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
