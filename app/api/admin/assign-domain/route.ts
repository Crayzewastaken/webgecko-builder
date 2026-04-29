// app/api/admin/assign-domain/route.ts
// Assigns a custom domain alias to a client's Vercel project.
// Call this once the client's DNS is pointed at Vercel (76.76.21.21).
// GET /api/admin/assign-domain?jobId=job_xxx&domain=ironcorefitness.com.au&secret=xxx

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const domain = searchParams.get("domain");
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!jobId || !domain) {
    return NextResponse.json({ error: "jobId and domain required" }, { status: 400 });
  }

  const job = await redis.get<any>(`job:${jobId}`);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const vercelProjectName = job.vercelProjectName;
  if (!vercelProjectName) {
    return NextResponse.json({ error: "No vercelProjectName on job — rebuild required" }, { status: 400 });
  }

  const token = process.env.VERCEL_API_TOKEN!;
  const teamId = process.env.VERCEL_TEAM_ID;

  // 1. Add domain alias to the Vercel project
  const aliasRes = await fetch(
    `https://api.vercel.com/v10/projects/${vercelProjectName}/domains${teamId ? `?teamId=${teamId}` : ""}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: domain }),
    }
  );

  const aliasData = await aliasRes.json();
  if (!aliasRes.ok) {
    return NextResponse.json({ error: aliasData?.error?.message || "Failed to add domain", detail: aliasData }, { status: 500 });
  }

  // 2. Update Redis with the live domain
  await redis.set(`job:${jobId}`, {
    ...job,
    liveDomain: domain,
    liveUrl: `https://${domain}`,
  }, { ex: 86400 * 30 });

  if (job.clientSlug) {
    const client = await redis.get<any>(`client:${job.clientSlug}`);
    if (client) {
      await redis.set(`client:${job.clientSlug}`, {
        ...client,
        liveDomain: domain,
        liveUrl: `https://${domain}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    vercelProjectName,
    domain,
    previewUrl: `https://${vercelProjectName}.vercel.app`,
    liveUrl: `https://${domain}`,
    verification: aliasData.verification || [],
  });
}
