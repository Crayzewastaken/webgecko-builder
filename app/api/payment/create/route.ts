// app/api/payment/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createPaymentLink, createMonthlyPaymentLink } from "@/lib/square";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type PaymentStage = "deposit" | "final" | "monthly";

export interface PaymentRecord {
  stage: PaymentStage;
  amountDollars: number;
  paymentLinkId: string;
  paymentLinkUrl: string;
  orderId: string;
  status: "pending" | "paid" | "failed";
  paidAt?: string;
  squarePaymentId?: string;
}

export interface ClientPaymentState {
  depositPaid: boolean;
  finalUnlocked: boolean;   // set by owner via /api/payment/unlock
  finalPaid: boolean;
  monthlyActive: boolean;
  payments: Partial<Record<PaymentStage, PaymentRecord>>;
}

// GET /api/payment/create?slug=iron-core-fitness&stage=deposit
// Called by the client portal when the client opens the Quote tab
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

  const { jobId, businessName, email, quote } = clientData;
  const totalPrice: number = quote?.price || 0;
  const monthlyPrice: number = quote?.monthlyPrice || 0;
  const depositAmount = Math.round(totalPrice * 0.5 * 100) / 100;
  const finalAmount = totalPrice - depositAmount;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
  const redirectUrl = `${baseUrl}/c/${slug}?payment=done`;
  const paymentStateKey = `payment:${jobId}`;

  // Load existing payment state
  let paymentState: ClientPaymentState = await redis.get<ClientPaymentState>(paymentStateKey) || {
    depositPaid: false,
    finalUnlocked: false,
    finalPaid: false,
    monthlyActive: false,
    payments: {},
  };

  // Guard: don't create a link if already paid
  if (stage === "deposit" && paymentState.depositPaid) {
    return NextResponse.json({ alreadyPaid: true, stage });
  }
  if (stage === "final" && paymentState.finalPaid) {
    return NextResponse.json({ alreadyPaid: true, stage });
  }
  if (stage === "final" && !paymentState.finalUnlocked) {
    return NextResponse.json({ error: "Final payment not yet unlocked" }, { status: 403 });
  }
  if (stage === "monthly" && !paymentState.finalPaid) {
    return NextResponse.json({ error: "Final payment required first" }, { status: 403 });
  }

  // Return existing link if already created and not yet paid
  const existing = paymentState.payments[stage];
  if (existing && existing.status === "pending") {
    return NextResponse.json({ url: existing.paymentLinkUrl, stage, existing: true });
  }

  // Create the Square payment link
  let result: { url: string; paymentLinkId: string; orderId: string };
  const referenceId = `${jobId}-${stage}`;

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
        ? `Deposit to begin your website build. Balance due after final revision.`
        : `Final payment to launch your website.`,
      referenceId,
      redirectUrl,
      buyerEmail: email,
    });
  }

  // Save to Redis
  const record: PaymentRecord = {
    stage,
    amountDollars: stage === "deposit" ? depositAmount : stage === "final" ? finalAmount : monthlyPrice,
    paymentLinkId: result.paymentLinkId,
    paymentLinkUrl: result.url,
    orderId: result.orderId,
    status: "pending",
  };

  paymentState.payments[stage] = record;
  await redis.set(paymentStateKey, paymentState);

  return NextResponse.json({ url: result.url, stage, existing: false });
}