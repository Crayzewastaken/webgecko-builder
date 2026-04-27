// app/api/payment/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Inline quote calculation — mirrors worker/route.ts calculateQuote()
function calculatePrice(input: any): { totalPrice: number; monthlyPrice: number } {
  const features: string[] = Array.isArray(input?.features) ? input.features : [];
  const pageCount = Array.isArray(input?.pages) ? input.pages.length : 1;
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const isMultiPage = input?.siteType === "multi";

  let totalPrice = 1800;
  let monthlyPrice = 79;

  if (pageCount >= 8 || hasEcommerce || hasBooking) {
    totalPrice = 5500; monthlyPrice = 149;
  } else if (pageCount >= 4 || isMultiPage) {
    totalPrice = 3200; monthlyPrice = 99;
  }

  features.forEach(f => {
    if (f === "Blog") totalPrice += 150;
    if (f === "Photo Gallery") totalPrice += 100;
    if (f === "Reviews & Testimonials") totalPrice += 100;
    if (f === "Live Chat") totalPrice += 150;
    if (f === "Newsletter Signup") totalPrice += 100;
  });

  return { totalPrice, monthlyPrice };
}

// GET /api/payment/status?slug=iron-core-fitness
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  // Verify session cookie
  const sessionCookie = req.cookies.get("wg_client_slug")?.value;
  if (!sessionCookie || sessionCookie !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientData = await redis.get<any>(`client:${slug}`);
  if (!clientData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = clientData.jobId;

  // ── Resolve amounts ────────────────────────────────────────────────────────
  let totalPrice: number = Number(clientData.quote?.price) || 0;
  let monthlyPrice: number = Number(clientData.quote?.monthlyPrice) || 0;

  if (!totalPrice) {
    const jobData = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId);
    const inputSource = jobData?.userInput || clientData;
    const calc = calculatePrice(inputSource);
    totalPrice = calc.totalPrice;
    monthlyPrice = calc.monthlyPrice;
  }

  const deposit = Math.round(totalPrice * 0.5);
  const final = totalPrice - deposit;

  // Load payment state
  const paymentState = await redis.get<any>(`payment:${jobId}`) || {
    depositPaid: false, finalUnlocked: false, finalPaid: false, monthlyActive: false, payments: {},
  };

  return NextResponse.json({
    depositPaid: paymentState.depositPaid,
    finalUnlocked: paymentState.finalUnlocked,
    finalPaid: paymentState.finalPaid,
    monthlyActive: paymentState.monthlyActive,
    quote: {
      total: totalPrice,
      monthly: monthlyPrice,
      deposit,
      final,
    },
  });
}