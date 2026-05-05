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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
          // Sandbox the preview so it cannot access WebGecko origin cookies/storage or
      // run same-origin privileged scripts. allow-popups-to-escape-sandbox lets the
      // booking iframe open SuperSaas in a new tab if needed.
      "Content-Security-Policy": [
        "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
        "default-src 'self' https: data: blob:",
        "img-src https: data: blob:",
        "style-src 'unsafe-inline' https:",
        "script-src 'unsafe-inline' https:",
        "frame-src https:",
      ].join("; "),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
