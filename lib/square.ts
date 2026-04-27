// lib/square.ts
// Square API wrapper — all amounts in AUD cents (Square uses smallest currency unit)

const SQUARE_BASE = process.env.SQUARE_ENVIRONMENT === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

const SQUARE_VERSION = "2024-11-20";

function squareHeaders() {
  return {
    "Square-Version": SQUARE_VERSION,
    "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function squareRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    method,
    headers: squareHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || "Square API error";
    throw new Error(`Square ${res.status}: ${msg}`);
  }
  return data;
}

// Dollars → cents (Square uses smallest unit, no decimals for AUD)
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Create a one-time payment link
// Returns { url, orderId, paymentLinkId }
export async function createPaymentLink(params: {
  amountDollars: number;
  title: string;
  description: string;
  referenceId: string;      // your jobId — comes back in webhook
  redirectUrl: string;      // where Square sends the customer after payment
  buyerEmail?: string;
}) {
  const idempotencyKey = `${params.referenceId}-${Date.now()}`;

  const body = {
    idempotency_key: idempotencyKey,
    quick_pay: {
      name: params.title,
      price_money: {
        amount: toCents(params.amountDollars),
        currency: "AUD",
      },
      location_id: process.env.SQUARE_LOCATION_ID,
    },
    payment_note: params.description,
    pre_populated_data: params.buyerEmail
      ? { buyer_email: params.buyerEmail }
      : undefined,
    checkout_options: {
      redirect_url: params.redirectUrl,
      ask_for_shipping_address: false,
    },
    order_service_charge: undefined,
    // Attach your reference so webhook can identify the job
    order: undefined,
    // Use reference_id via quick_pay note — webhook uses order metadata
    payment_link_request_metadata: undefined,
  };

  // Square Quick Pay doesn't support reference_id directly,
  // so we embed it in the note and also pass it via the API's order object
  const fullBody = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: process.env.SQUARE_LOCATION_ID,
      reference_id: params.referenceId,
      line_items: [
        {
          name: params.title,
          note: params.description,
          quantity: "1",
          base_price_money: {
            amount: toCents(params.amountDollars),
            currency: "AUD",
          },
        },
      ],
    },
    payment_note: `${params.referenceId}`,
    pre_populated_data: params.buyerEmail
      ? { buyer_email: params.buyerEmail }
      : undefined,
    checkout_options: {
      redirect_url: params.redirectUrl,
      ask_for_shipping_address: false,
    },
  };

  const data = await squareRequest("POST", "/v2/online-checkout/payment-links", fullBody);
  return {
    url: data.payment_link?.url as string,
    paymentLinkId: data.payment_link?.id as string,
    orderId: data.related_resources?.orders?.[0]?.id as string,
  };
}

// Create a subscription plan + subscribe the customer
// Square subscriptions require a Customer + Card on file.
// For WebGecko, we instead create a recurring payment link (monthly invoice link)
// because we don't store cards. Customer clicks monthly link each month.
// For a true auto-charge subscription, Square requires OAuth or card-on-file — 
// that's a future upgrade. For now: generate a reusable monthly payment link.
export async function createMonthlyPaymentLink(params: {
  monthlyDollars: number;
  businessName: string;
  referenceId: string;
  redirectUrl: string;
  buyerEmail?: string;
}) {
  // We create a standard payment link for the first month.
  // For recurring, we'll re-create this link each month via a cron job (future).
  // For now: one link the client can use to pay month 1.
  return createPaymentLink({
    amountDollars: params.monthlyDollars,
    title: `${params.businessName} — Monthly Hosting & Maintenance`,
    description: `Monthly performance & hosting fee for ${params.businessName}`,
    referenceId: `${params.referenceId}-monthly`,
    redirectUrl: params.redirectUrl,
    buyerEmail: params.buyerEmail,
  });
}

// Verify a Square webhook signature
// Square signs webhooks with HMAC-SHA256
export async function verifySquareWebhook(
  body: string,
  signatureHeader: string,
  notificationUrl: string
): Promise<boolean> {
  const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(notificationUrl + body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computed = Buffer.from(sig).toString("base64");

  // Constant-time compare
  if (computed.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

// Retrieve a Square order by ID
export async function getOrder(orderId: string) {
  const data = await squareRequest("GET", `/v2/orders/${orderId}`);
  return data.order;
}