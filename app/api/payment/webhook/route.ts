// app/api/payment/webhook/route.ts
// Square sends payment events here. Must be a raw body handler.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { verifySquareWebhook } from "@/lib/square";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface ClientPaymentState {
  depositPaid: boolean;
  finalUnlocked: boolean;
  finalPaid: boolean;
  monthlyActive: boolean;
  previewUnlocked: boolean;
  previewUnlockedAt?: string;
  payments: Record<string, {
    stage: string;
    status: string;
    paidAt?: string;
    squarePaymentId?: string;
    orderId: string;
    paymentLinkId: string;
    paymentLinkUrl: string;
    amountDollars: number;
  }>;
}

export async function POST(req: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";

  // 2. Verify signature — reject anything that doesn't match
  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook`;
  const isValid = await verifySquareWebhook(rawBody, signatureHeader, webhookUrl);

  if (!isValid) {
    console.error("Square webhook: invalid signature — request rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse event
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = event.type || "";
  console.log(`Square webhook received: ${eventType}`);

  // 4. Handle payment completion
  // Square sends payment.completed when a payment link is paid
  if (eventType === "payment.completed" || eventType === "payment.updated") {
    const payment = event.data?.object?.payment;
    if (!payment) return NextResponse.json({ ok: true });

    const squarePaymentId: string = payment.id;
    const status: string = payment.status; // COMPLETED, FAILED, CANCELED
    const orderId: string = payment.order_id;

    if (status !== "COMPLETED") {
      console.log(`Square payment ${squarePaymentId} status: ${status} — no action`);
      return NextResponse.json({ ok: true });
    }

    // Find which job this belongs to via order reference_id
    // reference_id format: "job_1234567890-deposit" | "job_1234567890-final" | "job_1234567890-monthly"
    let referenceId: string = payment.reference_id || "";

    // If not on the payment directly, fetch the order
    if (!referenceId && orderId) {
      try {
        const orderRes = await fetch(
          `${process.env.SQUARE_ENVIRONMENT === "production"
            ? "https://connect.squareup.com"
            : "https://connect.squareupsandbox.com"}/v2/orders/${orderId}`,
          {
            headers: {
              "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
              "Square-Version": "2024-11-20",
            },
          }
        );
        const orderData = await orderRes.json();
        referenceId = orderData.order?.reference_id || "";
      } catch (e) {
        console.error("Failed to fetch Square order:", e);
      }
    }

    if (!referenceId) {
      console.warn("Square webhook: no reference_id found on payment or order");
      return NextResponse.json({ ok: true });
    }

    // Parse: "job_1234567890-deposit" → jobId="job_1234567890", stage="deposit"
    const lastDash = referenceId.lastIndexOf("-");
    const stage = referenceId.slice(lastDash + 1) as "deposit" | "final" | "monthly";
    const jobId = referenceId.slice(0, lastDash);

    if (!["deposit", "final", "monthly"].includes(stage)) {
      console.warn(`Square webhook: unknown stage "${stage}" in referenceId "${referenceId}"`);
      return NextResponse.json({ ok: true });
    }

    // 5. Update payment state in Redis
    const paymentStateKey = `payment:${jobId}`;
    const paymentState: ClientPaymentState = await redis.get<ClientPaymentState>(paymentStateKey) || {
      depositPaid: false,
      finalUnlocked: false,
      finalPaid: false,
      monthlyActive: false,
      previewUnlocked: false,
      payments: {},
    };

    // Mark the specific payment as paid
    if (paymentState.payments[stage]) {
      paymentState.payments[stage].status = "paid";
      paymentState.payments[stage].paidAt = new Date().toISOString();
      paymentState.payments[stage].squarePaymentId = squarePaymentId;
    }

    if (stage === "deposit") paymentState.depositPaid = true;
    if (stage === "final") paymentState.finalPaid = true;
    if (stage === "monthly") paymentState.monthlyActive = true;

    await redis.set(paymentStateKey, paymentState);
    console.log(`Payment confirmed: jobId=${jobId} stage=${stage} paymentId=${squarePaymentId}`);

    // 5b. If deposit paid — trigger Inngest build
    if (stage === "deposit") {
      try {
        // Send event to Inngest to trigger the build
        await inngest.send({
          name: "build/website",
          data: { jobId },
        });
        console.log(`Build triggered via Inngest for ${jobId}`);
      } catch (e) {
        console.error(`Failed to trigger Inngest build for ${jobId}:`, e);
      }
    }

    // 6. If final payment confirmed — auto-unlock site launch
    //    (update client portal to show launch ready state)
    if (stage === "final") {
      try {
        const clientData = await redis.get<any>(`client:${jobId.replace("job_", "")}`) ||
          // slug may differ from jobId, so search by jobId
          null;

        // Find client slug by scanning — or store it on the job record
        const jobData = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId);
        if (jobData) {
          const slug = jobData.fileName || jobData.userInput?.businessName
            ?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
          if (slug) {
            const existing = await redis.get<any>(`client:${slug}`);
            if (existing) {
              await redis.set(`client:${slug}`, {
                ...existing,
                launchReady: true,
                launchReadyAt: new Date().toISOString(),
              });
              console.log(`Site launch unlocked for slug=${slug}`);
            }
          }
        }
      } catch (e) {
        console.error("Failed to update launch status:", e);
      }
    }
  }

  // Always return 200 to Square — non-200 causes retries
  return NextResponse.json({ ok: true });
}