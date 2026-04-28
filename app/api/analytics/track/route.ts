// app/api/analytics/track/route.ts
// Receives events from injected site snippet: page_view, booking_click, contact_click, form_submit
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, event, page } = await req.json();
    if (!jobId || !event) return Response.json({ ok: false }, { status: 400, headers: CORS });

    const validEvents = ["page_view", "booking_click", "contact_click", "form_submit"];
    if (!validEvents.includes(event)) return Response.json({ ok: false }, { status: 400, headers: CORS });

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const month = today.slice(0, 7); // YYYY-MM

    // Increment daily counter: analytics:{jobId}:daily:{date}:{event}
    await redis.incr(`analytics:${jobId}:daily:${today}:${event}`);
    // Increment monthly counter: analytics:{jobId}:monthly:{month}:{event}
    await redis.incr(`analytics:${jobId}:monthly:${month}:${event}`);
    // Increment all-time: analytics:{jobId}:total:{event}
    await redis.incr(`analytics:${jobId}:total:${event}`);

    // Track unique pages viewed (keep last 30 days rolling)
    if (event === "page_view" && page) {
      await redis.zincrby(`analytics:${jobId}:pages`, 1, page);
      await redis.expire(`analytics:${jobId}:pages`, 60 * 60 * 24 * 30);
    }

    // Set TTL on daily keys (keep 90 days)
    await redis.expire(`analytics:${jobId}:daily:${today}:${event}`, 60 * 60 * 24 * 90);

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    console.error("Analytics track error:", e);
    return Response.json({ ok: false }, { status: 500, headers: CORS });
  }
}
