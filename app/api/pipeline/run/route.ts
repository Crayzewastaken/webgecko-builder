// app/api/pipeline/run/route.ts
// Triggers the Inngest build pipeline. Returns immediately — Inngest handles execution.

export const maxDuration = 30;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Keep runPipeline export for any legacy callers (no-op redirect to Inngest)
export async function runPipeline(jobId: string): Promise<{ success: boolean; error?: string }> {
  await inngest.send({ name: "build/website", data: { jobId } });
  return { success: true };
}

// ─── GET — manual trigger by owner ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || searchParams.get("id");
  const secret = searchParams.get("secret");

  if (!jobId || secret !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const job = await redis.get<any>(`job:${jobId}`);
  if (!job) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;">
        <h1 style="color:#ef4444">❌ Job Not Found</h1><p>No job with ID: ${jobId}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  await inngest.send({ name: "build/website", data: { jobId } });

  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;">
      <h1 style="color:#22c55e">✅ Build Queued</h1>
      <p>Pipeline started for: <strong>${job.userInput?.businessName || jobId}</strong></p>
      <p style="color:#94a3b8;font-size:14px;">Inngest will run each step independently. You'll receive an email when complete (typically 5–10 minutes).</p>
      <p style="color:#475569;font-size:12px;margin-top:24px;">Job ID: ${jobId}</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// ─── POST — triggered by webhook ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { jobId, secret } = body;

  if (!jobId || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({ name: "build/website", data: { jobId } });
  return NextResponse.json({ success: true, queued: true, jobId });
}
