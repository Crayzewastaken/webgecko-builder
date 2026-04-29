// app/api/admin/delete-client/route.ts
// Permanently deletes a client and all their associated data from Redis.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!jobId && !slug) {
    return NextResponse.json({ error: "jobId or slug required" }, { status: 400 });
  }

  try {
    const deleted: string[] = [];

    // Delete job
    if (jobId) {
      await redis.del(`job:${jobId}`);
      deleted.push(`job:${jobId}`);

      // Delete payment state
      await redis.del(`payment:${jobId}`);
      deleted.push(`payment:${jobId}`);

      // Delete availability config
      await redis.del(`availability:${jobId}`);
      deleted.push(`availability:${jobId}`);

      // Delete all bookings
      const indexKey = `bookings:index:${jobId}`;
      const bookingIds = await redis.get<string[]>(indexKey) ?? [];
      for (const bid of bookingIds) {
        await redis.del(`booking:${jobId}:${bid}`);
        deleted.push(`booking:${jobId}:${bid}`);
      }
      await redis.del(indexKey);
      deleted.push(indexKey);

      // Delete analytics
      await redis.del(`analytics:${jobId}`);
      deleted.push(`analytics:${jobId}`);
    }

    // Delete client record
    if (slug) {
      await redis.del(`client:${slug}`);
      deleted.push(`client:${slug}`);
    } else if (jobId) {
      // Try to find client slug from job
      const job = await redis.get<any>(`job:${jobId}`);
      if (job?.clientSlug) {
        await redis.del(`client:${job.clientSlug}`);
        deleted.push(`client:${job.clientSlug}`);
      }
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("Delete client error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
