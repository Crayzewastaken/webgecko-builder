// lib/stripe-connect.ts
// Stripe Connect helpers for WebGecko's multi-seller platform.
// WebGecko takes a 2% application fee on every transaction.
// Payments go directly to each client's Stripe connected account.

import Stripe from "stripe";

// WebGecko's application fee — 2% of every transaction
export const WEBGECKO_FEE_PERCENT = 2;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-04-30" });
}

// ─── Shop / Products ──────────────────────────────────────────────────────────

export interface ShopProduct {
  name: string;
  price: string;       // e.g. "$25", "from $85", "$1,200.00"
  description?: string;
  photoUrl?: string;
  stock?: number;      // undefined = unlimited
}

export interface StripeShopItem {
  name: string;
  priceId: string;
  productId: string;
  priceCents: number;
  paymentLinkUrl: string;
  paymentLinkId: string;
  stock?: number;
}

/** Parse a price string like "$25", "from $85", "$1,200.00" → cents */
function parsePriceCents(price: string): number {
  const match = price.replace(/,/g, "").match(/[\d]+\.?\d*/);
  const dollars = match ? parseFloat(match[0]) : 0;
  return Math.round(dollars * 100);
}

/**
 * Create a full Stripe shop catalogue for a client.
 * - Creates a Stripe Product + Price for each item
 * - Creates a Stripe Payment Link for each item
 * - WebGecko takes 2% application fee on every payment (via Stripe Connect)
 * - Payments go directly to the client's connected Stripe account
 *
 * @param connectedAccountId  The client's Stripe connected account ID (acct_xxx)
 * @param products            Array of products extracted from the site brief
 * @param redirectUrl         URL to redirect buyer after checkout (client's live site)
 * @param jobId               Used for idempotency keys
 */
export async function createStripeShopCatalogue(params: {
  connectedAccountId: string;
  products: ShopProduct[];
  redirectUrl: string;
  jobId: string;
  businessName: string;
}): Promise<StripeShopItem[]> {
  const { connectedAccountId, products, redirectUrl, jobId, businessName } = params;
  const stripe = getStripe();
  const results: StripeShopItem[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const priceCents = parsePriceCents(product.price);

    if (priceCents <= 0) {
      console.warn(`[Stripe Shop] Skipping "${product.name}" — could not parse price "${product.price}"`);
      continue;
    }

    try {
      // 1. Create the Product on the client's connected account
      const stripeProduct = await stripe.products.create(
        {
          name: product.name,
          description: product.description || product.name,
          ...(product.photoUrl ? { images: [product.photoUrl] } : {}),
          metadata: { webgecko_job_id: jobId, webgecko_index: String(i) },
        },
        { stripeAccount: connectedAccountId }
      );

      // 2. Create the Price
      const stripePrice = await stripe.prices.create(
        {
          product: stripeProduct.id,
          unit_amount: priceCents,
          currency: "aud",
        },
        { stripeAccount: connectedAccountId }
      );

      // 3. Create the Payment Link (with WebGecko 2% application fee)
      const feePercent = WEBGECKO_FEE_PERCENT; // 2%
      const stripePaymentLink = await stripe.paymentLinks.create(
        {
          line_items: [{ price: stripePrice.id, quantity: 1 }],
          application_fee_percent: feePercent,
          after_completion: {
            type: "redirect",
            redirect: { url: redirectUrl },
          },
          metadata: {
            webgecko_job_id: jobId,
            webgecko_product_index: String(i),
            business_name: businessName,
          },
          // Allow quantity adjustment only if stock is undefined (unlimited)
          ...(product.stock !== undefined
            ? {}
            : {}),
        },
        { stripeAccount: connectedAccountId }
      );

      results.push({
        name: product.name,
        productId: stripeProduct.id,
        priceId: stripePrice.id,
        priceCents,
        paymentLinkUrl: stripePaymentLink.url,
        paymentLinkId: stripePaymentLink.id,
        stock: product.stock,
      });

      console.log(`[Stripe Shop] Created: "${product.name}" → ${stripePaymentLink.url}`);
    } catch (e) {
      console.error(`[Stripe Shop] Failed for product ${i} "${product.name}":`, e);
    }
  }

  return results;
}

/**
 * Fetch the client's existing Stripe products + payment links
 * (used to display them in admin without re-creating)
 */
export async function getStripeShopItems(connectedAccountId: string): Promise<StripeShopItem[]> {
  const stripe = getStripe();

  try {
    const paymentLinks = await stripe.paymentLinks.list(
      { active: true, limit: 50 },
      { stripeAccount: connectedAccountId }
    );

    const results: StripeShopItem[] = [];

    for (const link of paymentLinks.data) {
      // Get the line items for this payment link
      const lineItems = await stripe.paymentLinks.listLineItems(
        link.id,
        { limit: 1 },
        { stripeAccount: connectedAccountId }
      );
      const item = lineItems.data[0];
      if (!item?.price) continue;

      const price = await stripe.prices.retrieve(
        typeof item.price === "string" ? item.price : item.price.id,
        { stripeAccount: connectedAccountId }
      );

      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const product = await stripe.products.retrieve(productId, { stripeAccount: connectedAccountId });

      if (!product.active) continue;

      results.push({
        name: product.name,
        productId: product.id,
        priceId: price.id,
        priceCents: price.unit_amount || 0,
        paymentLinkUrl: link.url,
        paymentLinkId: link.id,
      });
    }

    return results;
  } catch (e) {
    console.error("[Stripe Shop] Error fetching items:", e);
    return [];
  }
}

/**
 * Deactivate a Stripe payment link (e.g. when item is out of stock)
 */
export async function deactivatePaymentLink(
  paymentLinkId: string,
  connectedAccountId: string
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentLinks.update(
    paymentLinkId,
    { active: false },
    { stripeAccount: connectedAccountId }
  );
}

/**
 * Verify a Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
