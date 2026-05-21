// app/api/payment/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClient, getJob, getPaymentState } from "@/lib/db";
import { calculatePrice } from "@/lib/pricing";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const sessionCookie = req.cookies.get("wg_client_slug")?.value;
  if (!sessionCookie || sessionCookie !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientData = await getClient(slug);
  if (!clientData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = clientData.job_id;

  let totalPrice = 0;
  let monthlyPrice = 109;

  const [job, ps] = await Promise.all([getJob(jobId), getPaymentState(jobId)]);
  if (job?.userInput) {
    const calc = calculatePrice(job.userInput);
    totalPrice = calc.totalPrice;
    monthlyPrice = calc.monthlyPrice;
  }

  const deposit = Math.round(totalPrice * 0.5);
  const final = totalPrice - deposit;

  return NextResponse.json({
    depositPaid: ps?.deposit_paid ?? false,
    finalUnlocked: ps?.final_unlocked ?? false,
    finalPaid: ps?.final_paid ?? false,
    monthlyActive: ps?.monthly_active ?? false,
    previewUnlocked: ps?.preview_unlocked ?? false,
    quote: { total: totalPrice, monthly: monthlyPrice, deposit, final },
  });
}
