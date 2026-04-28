// app/api/unlock/release/route.ts
// Owner clicks "Release to Client" button — unlocks preview & bookings for the client
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
    return new Response(
      "<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;\">" +
      "<h1 style=\"color:#ef4444\">❌ Unauthorized</h1>" +
      "<p>Invalid or missing credentials.</p>" +
      "</body></html>",
      { headers: { "Content-Type": "text/html" }, status: 403 }
    );
  }

  try {
    // Update payment state to unlock preview
    const paymentStateKey = `payment:${jobId}`;
    const paymentState = await redis.get<any>(paymentStateKey);

    if (!paymentState) {
      return new Response(
        "<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;\">" +
        "<h1 style=\"color:#ef4444\">❌ Job Not Found</h1>" +
        "<p>Could not find job record.</p>" +
        "</body></html>",
        { headers: { "Content-Type": "text/html" }, status: 404 }
      );
    }

    await redis.set(paymentStateKey, {
      ...paymentState,
      previewUnlocked: true,
      previewUnlockedAt: new Date().toISOString(),
    });

    return new Response(
      "<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;\">" +
      "<h1 style=\"color:#22c55e\">✅ Site Released to Client</h1>" +
      "<p>The client can now see the preview and booking system.</p>" +
      "</body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e) {
    console.error("Release unlock failed:", e);
    return new Response(
      "<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;\">" +
      "<h1 style=\"color:#ef4444\">❌ Error</h1>" +
      "<p>Failed to unlock preview.</p>" +
      "</body></html>",
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
