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

// Dollars -> cents (Square uses smallest unit, no decimals for AUD)
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Create a one-time payment link.
// Uses the order object (not quick_pay) so reference_id is embedded —
// this is how the webhook knows which job + stage was paid.
// Returns { url, paymentLinkId, orderId }
export async function createPaymentLink(params: {
  amountDollars: number;
  title: string;
  description: string;
  referenceId: string;   // format: "job_xxx-deposit" | "job_xxx-final" | "job_xxx-monthly"
  redirectUrl: string;
  buyerEmail?: string;
}) {
  const body: Record<string, unknown> = {
    idempotency_key: `${params.referenceId}-${Date.now()}`,
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
    checkout_options: {
      redirect_url: params.redirectUrl,
      ask_for_shipping_address: false,
    },
  };

  if (params.buyerEmail) {
    body.pre_populated_data = { buyer_email: params.buyerEmail };
  }

  const data = await squareRequest("POST", "/v2/online-checkout/payment-links", body);

  return {
    url: data.payment_link?.url as string,
    paymentLinkId: data.payment_link?.id as string,
    orderId: data.related_resources?.orders?.[0]?.id as string,
  };
}

// Monthly payment link — just a regular payment link for the first month.
// referenceId passed in is already "job_xxx-monthly" from the create route.
export async function createMonthlyPaymentLink(params: {
  monthlyDollars: number;
  businessName: string;
  referenceId: string;
  redirectUrl: string;
  buyerEmail?: string;
}) {
  return createPaymentLink({
    amountDollars: params.monthlyDollars,
    title: `${params.businessName} — Monthly Hosting & Maintenance`,
    description: `Monthly performance & hosting fee for ${params.businessName}`,
    referenceId: params.referenceId,   // NOT appending -monthly again — caller already did
    redirectUrl: params.redirectUrl,
    buyerEmail: params.buyerEmail,
  });
}

// Verify a Square webhook signature (HMAC-SHA256)
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

  // Constant-time compare to prevent timing attacks
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