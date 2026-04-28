// app/api/preview/proxy/route.ts
// Serves stored site HTML directly — bypasses X-Frame-Options on Vercel deployments.
import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  if (!jobId && !slug) return new Response("Missing params", { status: 400 });

  let html = "";
  if (jobId) {
    const job = await redis.get<any>("job:" + jobId);
    html = job?.html || "";
  } else if (slug) {
    const client = await redis.get<any>("client:" + slug);
    if (client?.jobId) {
      const job = await redis.get<any>("job:" + client.jobId);
      html = job?.html || "";
    }
  }

  if (!html) return new Response("Site not ready yet", { status: 404 });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
