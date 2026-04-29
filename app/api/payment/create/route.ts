// app/api/payment/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createPaymentLink, createMonthlyPaymentLink } from "@/lib/square";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type PaymentStage = "deposit" | "final" | "monthly";

// Inline quote calculation — mirrors worker/route.ts calculateQuote()
function calculatePrice(userInput: any): { totalPrice: number; monthlyPrice: number } {
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const pageCount = Array.isArray(userInput?.pages) ? userInput.pages.length : 1;
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const isMultiPage = userInput?.siteType === "multi";

  // Package by page count — features are add-ons, not package triggers
  let totalPrice = 1500;
  let monthlyPrice = 69;
  if (pageCount >= 7 || isMultiPage && pageCount >= 5) {
    totalPrice = 3800; monthlyPrice = 129;
  } else if (pageCount >= 4 || isMultiPage) {
    totalPrice = 2400; monthlyPrice = 89;
  }

  if (hasBooking) totalPrice += 400;
  if (hasEcommerce) totalPrice += 600;
  features.forEach(f => {
    if (f === "Blog") totalPrice += 200;
    if (f === "Photo Gallery") totalPrice += 150;
    if (f === "Reviews & Testimonials") totalPrice += 100;
    if (f === "Live Chat") totalPrice += 150;
    if (f === "Newsletter Signup") totalPrice += 100;
    if (f === "Video Background") totalPrice += 200;
  });

  return { totalPrice, monthlyPrice };
}

// GET /api/payment/create?slug=iron-core-fitness&stage=deposit
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const stage = searchParams.get("stage") as PaymentStage | null;

  if (!slug || !stage || !["deposit", "final", "monthly"].includes(stage)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  // Verify session cookie
  const sessionCookie = req.cookies.get("wg_client_slug")?.value;
  if (!sessionCookie || sessionCookie !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load client data
  const clientData = await redis.get<any>(`client:${slug}`);
  if (!clientData) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { jobId, businessName, email } = clientData;

  // ── Resolve amounts ──────────────────────────────────────────────────────────
  // Priority: stored quote → recalculate from job userInput → recalculate from clientData fields
  let totalPrice: number = Number(clientData.quote?.price) || 0;
  let monthlyPrice: number = Number(clientData.quote?.monthlyPrice) || 0;

  if (!totalPrice) {
    // Try job record
    const jobData = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId);
    const inputSource = jobData?.userInput || clientData; // clientData itself has features/pages/siteType
    const calc = calculatePrice(inputSource);
    totalPrice = calc.totalPrice;
    monthlyPrice = calc.monthlyPrice;

    // Persist so we don't recalculate every time
    await redis.set(`client:${slug}`, {
      ...clientData,
      quote: {
        price: totalPrice,
        monthlyPrice,
        package: totalPrice >= 5500 ? "Premium" : totalPrice >= 3200 ? "Business" : "Starter",
        savings: totalPrice,
        competitorPrice: totalPrice * 2,
        breakdown: [`Base package: $${totalPrice}`],
      },
    });
  }

  if (!totalPrice || totalPrice <= 0) {
    return NextResponse.json(
      { error: "Could not determine quote amount. Please contact hello@webgecko.au" },
      { status: 422 }
    );
  }

  const depositAmount = Math.round(totalPrice * 0.5 * 100) / 100;
  const finalAmount = Math.round((totalPrice - depositAmount) * 100) / 100;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
  const redirectUrl = `${baseUrl}/c/${slug}?payment=done`;
  const paymentStateKey = `payment:${jobId}`;

  // Load payment state
  const paymentState = await redis.get<any>(paymentStateKey) || {
    depositPaid: false, finalUnlocked: false, finalPaid: false, monthlyActive: false, payments: {},
  };

  // Guards
  if (stage === "deposit" && paymentState.depositPaid) return NextResponse.json({ alreadyPaid: true, stage });
  if (stage === "final" && paymentState.finalPaid) return NextResponse.json({ alreadyPaid: true, stage });
  if (stage === "final" && !paymentState.finalUnlocked) return NextResponse.json({ error: "Final payment not yet unlocked" }, { status: 403 });
  if (stage === "monthly" && !paymentState.finalPaid) return NextResponse.json({ error: "Final payment required first" }, { status: 403 });

  // Return existing pending link if still valid
  const existing = paymentState.payments?.[stage];
  if (existing?.status === "pending" && existing?.paymentLinkUrl) {
    return NextResponse.json({ url: existing.paymentLinkUrl, stage, existing: true });
  }

  // Create Square payment link
  const referenceId = `${jobId}-${stage}`;
  let result: { url: string; paymentLinkId: string; orderId: string };

  try {
    if (stage === "monthly") {
      result = await createMonthlyPaymentLink({
        monthlyDollars: monthlyPrice,
        businessName,
        referenceId,
        redirectUrl,
        buyerEmail: email,
      });
    } else {
      const amount = stage === "deposit" ? depositAmount : finalAmount;
      const label = stage === "deposit" ? "50% Deposit" : "50% Final Payment";
      result = await createPaymentLink({
        amountDollars: amount,
        title: `${businessName} — ${label}`,
        description: stage === "deposit"
          ? "Deposit to begin your website build. Balance due after final revision."
          : "Final payment to launch your website.",
        referenceId,
        redirectUrl,
        buyerEmail: email,
      });
    }
  } catch (err: any) {
    console.error("Square createPaymentLink error:", err?.message);
    return NextResponse.json(
      { error: `Payment setup failed: ${err?.message || "Unknown error"}` },
      { status: 502 }
    );
  }

  // Save link to Redis
  const record = {
    stage,
    amountDollars: stage === "deposit" ? depositAmount : stage === "final" ? finalAmount : monthlyPrice,
    paymentLinkId: result.paymentLinkId,
    paymentLinkUrl: result.url,
    orderId: result.orderId,
    status: "pending",
  };

  await redis.set(paymentStateKey, {
    ...paymentState,
    payments: { ...paymentState.payments, [stage]: record },
  });

  return NextResponse.json({ url: result.url, stage, existing: false });
}