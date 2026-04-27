// app/api/payment/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// GET /api/payment/status?slug=iron-core-fitness
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  // Verify session
  const sessionCookie = req.cookies.get("wg_client_slug")?.value;
  if (!sessionCookie || sessionCookie !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientData = await redis.get<any>(`client:${slug}`);
  if (!clientData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = clientData.jobId;
  const paymentState = await redis.get<any>(`payment:${jobId}`) || {
    depositPaid: false,
    finalUnlocked: false,
    finalPaid: false,
    monthlyActive: false,
    payments: {},
  };

  // Return only what the client needs — no Square IDs or sensitive data
  return NextResponse.json({
    depositPaid: paymentState.depositPaid,
    finalUnlocked: paymentState.finalUnlocked,
    finalPaid: paymentState.finalPaid,
    monthlyActive: paymentState.monthlyActive,
    // Include amounts from client quote for display
    quote: {
      total: clientData.quote?.price || 0,
      monthly: clientData.quote?.monthlyPrice || 0,
      deposit: Math.round((clientData.quote?.price || 0) * 0.5),
      final: Math.round((clientData.quote?.price || 0) * 0.5),
    },
  });
}