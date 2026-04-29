// app/api/unlock/booking/route.ts
// Admin unlocks booking system for a client.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const job = await redis.get<any>(`job:${jobId}`);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Update job to have booking enabled
    await redis.set(`job:${jobId}`, { ...job, hasBooking: true, bookingUnlockedAt: new Date().toISOString() });

    // Update client record too
    const clientSlug = job.clientSlug || job.fileName;
    if (clientSlug) {
      const client = await redis.get<any>(`client:${clientSlug}`);
      if (client) {
        await redis.set(`client:${clientSlug}`, { ...client, hasBooking: true });
      }
    }

    return NextResponse.json({ ok: true, message: "Booking system unlocked" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
