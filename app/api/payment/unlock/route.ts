// app/api/payment/unlock/route.ts
// Owner-only route — unlocks the final 50% payment for a client
// Called via the "Unlock Final Payment" button in the owner email

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// GET /api/payment/unlock?jobId=job_xxx&secret=PROCESS_SECRET
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret) {
    return new Response("Missing params", { status: 400 });
  }
  if (secret !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const paymentStateKey = `payment:${jobId}`;
  const existing = await redis.get<any>(paymentStateKey) || {
    depositPaid: false,
    finalUnlocked: false,
    finalPaid: false,
    monthlyActive: false,
    payments: {},
  };

  if (!existing.depositPaid) {
    return new Response(renderPage("⚠️ Cannot Unlock", "Deposit has not been paid yet.", "#f59e0b"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (existing.finalUnlocked) {
    return new Response(renderPage("ℹ️ Already Unlocked", "Final payment was already unlocked for this client.", "#0099ff"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  await redis.set(paymentStateKey, {
    ...existing,
    finalUnlocked: true,
    finalUnlockedAt: new Date().toISOString(),
  });

  console.log(`Final payment unlocked for jobId=${jobId}`);

  return new Response(
    renderPage("✅ Final Payment Unlocked", "The client can now pay the remaining 50% to launch their site.", "#00c896"),
    { headers: { "Content-Type": "text/html" } }
  );
}

function renderPage(title: string, message: string, color: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;background:#0f0f0f;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:48px;max-width:440px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">${title.split(" ")[0]}</div>
    <h1 style="color:${color};font-size:20px;margin:0 0 12px;">${title.slice(title.indexOf(" ") + 1)}</h1>
    <p style="color:#888;font-size:14px;">${message}</p>
  </div>
</body>
</html>`;
}