// app/api/payment/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPaymentLink, createMonthlyPaymentLink } from "@/lib/square";
import { getClient, saveClient, getJob, getPaymentState, savePaymentState } from "@/lib/db";

export type PaymentStage = "deposit" | "final" | "monthly";

function calculatePrice(userInput: any): { totalPrice: number; monthlyPrice: number; monthlyOngoing: number } {
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const pageCount = Array.isArray(userInput?.pages) ? userInput.pages.length : 1;
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const isMultiPage = userInput?.siteType === "multi";

  let totalPrice = 1500;
  if (pageCount >= 7 || (isMultiPage && pageCount >= 5)) totalPrice = 3800;
  else if (pageCount >= 4 || isMultiPage) totalPrice = 2400;

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

  return { totalPrice, monthlyPrice: 109, monthlyOngoing: 119 };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const stage = searchParams.get("stage") as PaymentStage | null;

  if (!slug || !stage || !["deposit", "final", "monthly"].includes(stage)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const sessionCookie = req.cookies.get("wg_client_slug")?.value;
  if (!sessionCookie || sessionCookie !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientData = await getClient(slug);
  if (!clientData) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const jobId = clientData.job_id;
  const businessName = clientData.business_name || "";
  const email = clientData.email || "";

  let totalPrice = 0;
  const monthlyPrice = 109;
  const monthlyOngoing = 119;

  const job = await getJob(jobId);
  if (job?.userInput) {
    const calc = calculatePrice(job.userInput);
    totalPrice = calc.totalPrice;
  }

  if (!totalPrice) return NextResponse.json({ error: "Could not determine quote" }, { status: 422 });

  const depositAmount = Math.round(totalPrice * 0.5 * 100) / 100;
  const remainingBalance = Math.round((totalPrice - depositAmount) * 100) / 100;
  const finalAmount = Math.round((remainingBalance + monthlyPrice) * 100) / 100;

  const redirectUrl = `https://webgecko-builder.vercel.app/c/${slug}?payment=done`;

  const paymentState = await getPaymentState(jobId) || {
    depositPaid: false, finalUnlocked: false, finalPaid: false, monthlyActive: false, payments: {},
  };

  const ps = {
    depositPaid: paymentState.deposit_paid ?? false,
    finalUnlocked: paymentState.final_unlocked ?? false,
    finalPaid: paymentState.final_paid ?? false,
    monthlyActive: paymentState.monthly_active ?? false,
    payments: paymentState.payments || {},
  };

  if (stage === "deposit" && ps.depositPaid) return NextResponse.json({ alreadyPaid: true, stage });
  if (stage === "final" && ps.finalPaid) return NextResponse.json({ alreadyPaid: true, stage });
  if (stage === "final" && !ps.finalUnlocked) return NextResponse.json({ error: "Final payment not yet unlocked" }, { status: 403 });
  if (stage === "monthly" && !ps.finalPaid) return NextResponse.json({ error: "Final payment required first" }, { status: 403 });

  const existing = ps.payments?.[stage];
  if (existing?.status === "pending" && existing?.paymentLinkUrl) {
    return NextResponse.json({ url: existing.paymentLinkUrl, stage, existing: true });
  }

  const referenceId = `${jobId}-${stage}`;
  let result: { url: string; paymentLinkId: string; orderId: string };

  try {
    if (stage === "monthly") {
      result = await createMonthlyPaymentLink({ monthlyDollars: monthlyPrice, businessName, referenceId, redirectUrl, buyerEmail: email });
    } else {
      const amount = stage === "deposit" ? depositAmount : finalAmount;
      const label = stage === "deposit" ? "50% Deposit" : "Final Payment + First Month";
      result = await createPaymentLink({
        amountDollars: amount,
        title: `${businessName} — ${label}`,
        description: stage === "deposit"
          ? "Deposit to begin your website build."
          : `Final payment ($${remainingBalance.toFixed(0)}) + first month hosting ($${monthlyPrice}/mo). After 3 months: $${monthlyOngoing}/mo.`,
        referenceId, redirectUrl, buyerEmail: email,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Payment setup failed: ${err?.message || "Unknown error"}` }, { status: 502 });
  }

  const record = {
    stage,
    amountDollars: stage === "deposit" ? depositAmount : stage === "final" ? finalAmount : monthlyPrice,
    paymentLinkId: result.paymentLinkId,
    paymentLinkUrl: result.url,
    orderId: result.orderId,
    status: "pending",
  };

  await savePaymentState(jobId, { ...ps, payments: { ...ps.payments, [stage]: record } });

  return NextResponse.json({ url: result.url, stage, existing: false });
}
