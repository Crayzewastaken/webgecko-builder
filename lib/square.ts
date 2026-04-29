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

// ─── Shop / Catalogue API ────────────────────────────────────────────────────

export interface ShopProduct {
  name: string;
  price: string;   // e.g. "$25" or "from $85" — we parse the number out
  photoUrl?: string;
  description?: string;
}

export interface SquareCatalogueItem {
  name: string;
  variationId: string;   // the ID needed for payment links
  itemId: string;
  imageId?: string;
  priceCents: number;
  paymentLinkUrl: string;
  paymentLinkId: string;
}

// Parse a price string like "$25", "from $85", "$1,200.00" into a dollar number
function parsePriceDollars(price: string): number {
  const match = price.replace(/,/g, "").match(/[\d]+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}

// Upload an image URL to Square's Catalogue Images API and return the image ID
async function createCatalogueImage(name: string, imageUrl: string, idempotencyKey: string): Promise<string | null> {
  try {
    // Square Catalogue Image requires a multipart upload — we fetch the image and post it
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const boundary = `boundary_${Date.now()}`;
    const requestJson = JSON.stringify({
      idempotency_key: idempotencyKey,
      object_id: null,
      image: {
        type: "IMAGE",
        id: `#img_${idempotencyKey}`,
        image_data: { name },
      },
    });
    // Build multipart body manually (fetch API doesn't easily do mixed multipart)
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="request"\r\nContent-Type: application/json\r\n\r\n${requestJson}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="product.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ];
    const encoder = new TextEncoder();
    const end = encoder.encode(`\r\n--${boundary}--\r\n`);
    const partBytes = parts.map(p => encoder.encode(p));
    const total = partBytes.reduce((a, b) => a + b.length, 0) + imgBuf.length + end.length;
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const b of partBytes) { merged.set(b, offset); offset += b.length; }
    merged.set(imgBuf, offset); offset += imgBuf.length;
    merged.set(end, offset);

    const res = await fetch(`${SQUARE_BASE}/v2/catalog/images`, {
      method: "POST",
      headers: {
        "Square-Version": SQUARE_VERSION,
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: merged,
    });
    const data = await res.json();
    return data?.image?.id || null;
  } catch (e) {
    console.error("[Square] Image upload failed:", e);
    return null;
  }
}

// Create a Square Catalogue item + variation + optional image.
// Returns the variation ID (needed to create payment links) and image ID.
async function createCatalogueItem(params: {
  jobId: string;
  name: string;
  priceCents: number;
  description?: string;
  photoUrl?: string;
  index: number;
}): Promise<{ itemId: string; variationId: string; imageId?: string }> {
  const { jobId, name, priceCents, description, photoUrl, index } = params;
  const itemKey = `${jobId}-item-${index}`;
  const variationKey = `${jobId}-var-${index}`;

  // Upload image first if we have one
  let imageId: string | undefined;
  if (photoUrl) {
    imageId = await createCatalogueImage(name, photoUrl, `${jobId}-img-${index}`) || undefined;
  }

  const body: any = {
    idempotency_key: itemKey,
    batches: [{
      objects: [{
        type: "ITEM",
        id: `#item_${index}`,
        item_data: {
          name,
          description: description || name,
          variations: [{
            type: "ITEM_VARIATION",
            id: `#var_${index}`,
            item_variation_data: {
              item_id: `#item_${index}`,
              name: "Standard",
              pricing_type: "FIXED_PRICING",
              price_money: { amount: priceCents, currency: "AUD" },
            },
          }],
          ...(imageId ? { image_ids: [imageId] } : {}),
        },
      }],
    }],
  };

  const data = await squareRequest("POST", "/v2/catalog/batch-upsert", body);
  const objects = data?.objects || [];
  const item = objects.find((o: any) => o.type === "ITEM");
  const variation = objects.find((o: any) => o.type === "ITEM_VARIATION");
  return {
    itemId: item?.id || "",
    variationId: variation?.id || "",
    imageId,
  };
}

// Create a Square Checkout / payment link for a single catalogue variation
async function createProductPaymentLink(params: {
  variationId: string;
  businessName: string;
  referenceId: string;
  redirectUrl: string;
}): Promise<{ url: string; paymentLinkId: string }> {
  const { variationId, businessName, referenceId, redirectUrl } = params;
  const body = {
    idempotency_key: `${referenceId}-link-${Date.now()}`,
    checkout_options: {
      redirect_url: redirectUrl,
      ask_for_shipping_address: false,
    },
    order: {
      location_id: process.env.SQUARE_LOCATION_ID,
      reference_id: referenceId,
      line_items: [{
        catalog_object_id: variationId,
        quantity: "1",
      }],
    },
    pre_populated_data: {},
  };
  const data = await squareRequest("POST", "/v2/online-checkout/payment-links", body);
  return {
    url: data.payment_link?.url as string,
    paymentLinkId: data.payment_link?.id as string,
  };
}

// Main entry point — create the full Square catalogue for a client's shop
// Called from the build pipeline after the site HTML is generated.
// Returns an array of items with their Square IDs and payment link URLs.
export async function createClientShopCatalogue(params: {
  jobId: string;
  businessName: string;
  products: ShopProduct[];
  redirectUrl: string;  // Where to send the buyer after checkout (the client's site)
}): Promise<SquareCatalogueItem[]> {
  const { jobId, businessName, products, redirectUrl } = params;
  const results: SquareCatalogueItem[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const priceDollars = parsePriceDollars(product.price);
    if (priceDollars <= 0) {
      console.warn(`[Square Shop] Skipping "${product.name}" — could not parse price "${product.price}"`);
      continue;
    }
    const priceCents = toCents(priceDollars);

    try {
      const { itemId, variationId, imageId } = await createCatalogueItem({
        jobId, name: product.name, priceCents,
        description: product.description,
        photoUrl: product.photoUrl,
        index: i,
      });

      if (!variationId) {
        console.error(`[Square Shop] No variationId for "${product.name}"`);
        continue;
      }

      const referenceId = `${jobId}-shop-${i}`;
      const { url: paymentLinkUrl, paymentLinkId } = await createProductPaymentLink({
        variationId, businessName,
        referenceId,
        redirectUrl,
      });

      results.push({
        name: product.name,
        variationId,
        itemId,
        imageId,
        priceCents,
        paymentLinkUrl,
        paymentLinkId,
      });

      console.log(`[Square Shop] Created: "${product.name}" → ${paymentLinkUrl}`);
    } catch (e) {
      console.error(`[Square Shop] Failed for product ${i} "${product.name}":`, e);
    }
  }

  return results;
}