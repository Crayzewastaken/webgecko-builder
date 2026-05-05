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
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const stage = searchParams.get("stage") as PaymentStage | null;

    if (!slug || !stage || !["deposit", "final", "monthly"].includes(stage)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const sessionCookie = req.cookies.get("wg_client_slug")?.value;
    console.log(`[Payment/create] slug=${slug} stage=${stage} cookie=${sessionCookie} match=${sessionCookie === slug}`);

    if (!sessionCookie || sessionCookie !== slug) {
      return NextResponse.json({ error: "Unauthorized — session cookie missing or mismatch" }, { status: 401 });
    }

    const clientData = await getClient(slug);
    if (!clientData) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const jobId = clientData.job_id;
    const businessName = clientData.business_name || "";
    const email = clientData.email || "";

    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { totalPrice, monthlyPrice, monthlyOngoing } = calculatePrice(job.userInput);
    if (!totalPrice) return NextResponse.json({ error: "Could not determine quote" }, { status: 422 });

    const depositAmount = Math.round(totalPrice * 0.5 * 100) / 100;
    const remainingBalance = Math.round((totalPrice - depositAmount) * 100) / 100;
    const finalAmount = Math.round((remainingBalance + monthlyPrice) * 100) / 100;

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app"}/c/${slug}?payment=done`;

    const rawPs = await getPaymentState(jobId);
    const ps = {
      depositPaid: rawPs?.deposit_paid ?? false,
      finalUnlocked: rawPs?.final_unlocked ?? false,
      finalPaid: rawPs?.final_paid ?? false,
      monthlyActive: rawPs?.monthly_active ?? false,
      previewUnlocked: rawPs?.preview_unlocked ?? false,
      payments: rawPs?.payments || {},
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

    console.log(`[Payment] Creating ${stage} link for ${businessName} (${jobId}) — SQUARE_ENV=${process.env.SQUARE_ENVIRONMENT} HAS_TOKEN=${!!process.env.SQUARE_ACCESS_TOKEN} HAS_LOC=${!!process.env.SQUARE_LOCATION_ID}`);

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
      console.error("[Payment] Square error:", err);
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

  } catch (err: any) {
    console.error("[Payment/create] Unhandled error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
