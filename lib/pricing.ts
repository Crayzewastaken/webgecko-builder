// lib/pricing.ts
// SINGLE SOURCE OF TRUTH for all WebGecko package pricing.
// Import from here — never hardcode prices anywhere else.

// ── Base package thresholds ────────────────────────────────────────────────
export const BASE_PRICES: Record<string, number> = {
  starter: 1500,   // 1–3 pages
  business: 2400,  // 4–6 pages
  premium: 3800,   // 7+ pages
};

// ── Add-on prices ──────────────────────────────────────────────────────────
export const ADDON_PRICES: Record<string, number> = {
  "Booking System":          400,
  "Payments / Shop":         600,
  "Blog":                    200,
  "Photo Gallery":           150,
  "Reviews & Testimonials":  100,
  "Live Chat":               150,
  "Newsletter Signup":       100,
  "Video Background":        200,
};

// ── Monthly hosting ────────────────────────────────────────────────────────
export const MONTHLY_INTRO    = 109;  // first 3 months
export const MONTHLY_ONGOING  = 119;  // month 4+

// ── Competitor comparison prices (for the calculator display) ──────────────
export const COMPETITOR_PRICES: Record<string, number> = {
  starter:  3000,
  business: 6500,
  premium:  12000,
};

// ── Package name map ───────────────────────────────────────────────────────
export type PackageName = "Starter" | "Business" | "Premium";

export interface PricingDetails {
  packageName: PackageName;
  totalPrice: number;
  monthlyPrice: number;
  monthlyOngoing: number;
  competitorPrice: number;
  savings: number;
}

export function calculatePrice(userInput: {
  features?: string[];
  pages?: string[];
  siteType?: string;
  [key: string]: any;
}): PricingDetails {
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const pageCount = Array.isArray(userInput?.pages) ? userInput.pages.length : 1;
  const isMultiPage = userInput?.siteType === "multi";

  let packageName: PackageName = "Starter";
  let basePrice = BASE_PRICES.starter;
  let competitorPrice = COMPETITOR_PRICES.starter;

  if (pageCount >= 7 || (isMultiPage && pageCount >= 5)) {
    packageName = "Premium";
    basePrice = BASE_PRICES.premium;
    competitorPrice = COMPETITOR_PRICES.premium;
  } else if (pageCount >= 4 || isMultiPage) {
    packageName = "Business";
    basePrice = BASE_PRICES.business;
    competitorPrice = COMPETITOR_PRICES.business;
  }

  let addons = 0;
  for (const f of features) {
    addons += ADDON_PRICES[f] ?? 0;
  }

  const totalPrice = basePrice + addons;

  return {
    packageName,
    totalPrice,
    monthlyPrice: MONTHLY_INTRO,
    monthlyOngoing: MONTHLY_ONGOING,
    competitorPrice,
    savings: competitorPrice - totalPrice,
  };
}
