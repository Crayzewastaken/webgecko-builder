// app/admin/types.ts

export interface SeoData {
  lsiKeywords?: string[];
  metaDescription?: string;
  serpInsights?: { avgWordCount: number; avgH2Count: number; topHeadings: string[]; winningStructure: string } | null;
  projectTitle?: string;
}

export interface ClientAnalytics {
  slug: string;
  jobId: string;
  businessName: string;
  industry: string;
  previewUrl: string;
  buildStatus: string;
  domain?: string;
  liveDomain?: string;
  liveUrl?: string;
  vercelProjectName?: string;
  paymentState: { depositPaid: boolean; finalPaid: boolean; monthlyActive: boolean };
  analytics: {
    thisMonth: { views: number; bookingClicks: number; contactClicks: number };
    today: { views: number; bookingClicks: number };
    totals: { views: number; bookingClicks: number; formSubmits: number };
    spark?: number[];
    sparkMonths?: string[];
  } | null;
  bookingCount: number;
  hasBooking: boolean;
  builtAt?: string;
  supersaasId?: string;
  supersaasUrl?: string;
  bookingServices?: string;
  clientEmail?: string;
  clientPhone?: string;
  tawktoPropertyId?: string;
  shopCatalogue?: any[] | null;
  logoUrl?: string;
  heroUrl?: string;
  photoUrls?: string[];
  squareAccessToken?: string;
  squareLocationId?: string;
  ga4Id?: string;
  stripeAccountId?: string;
  stripeConnectedAt?: string;
  shopPlatform?: string;
  userInput?: {
    features?: string[];
    pages?: string[];
    siteType?: string;
    style?: string;
    colorPrefs?: string;
    usp?: string;
    goal?: string;
    additionalNotes?: string;
    abn?: string;
    businessAddress?: string;
    facebookPage?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    bookingServices?: string;
  };
  metadata?: {
    scheduledReleaseAt?: string;
    scheduledReleaseDays?: number;
    checklistCompletedAt?: string;
    alreadyReleased?: boolean;
    seo?: SeoData;
    domainStatus?: string;
    domainUrl?: string;
    lastGoodAt?: string;
    lastGoodUrl?: string;
    lastGoodHtml?: string;
    rolledBackAt?: string;
  };
}

export const DARK = {
  bg: "#070d1a",
  surface: "#0c1526",
  raised: "#111f36",
  border: "rgba(255,255,255,0.07)",
  borderHov: "rgba(255,255,255,0.17)",
  text: "#f0f4ff",
  textSec: "#b8c8e0",
  textMuted: "#7a90a8",
  green: "#00d4a0",
  blue: "#4a9eff",
  amber: "#ff9f24",
  red: "#f43f5e",
  purple: "#8347ff",
  cyan: "#00e5ff",
  overlay: "rgba(4,8,15,0.92)",
  shadow: "0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
  shadowLg: "0 12px 40px rgba(0,0,0,0.85)",
  shadowXl: "-4px 0 60px rgba(0,0,0,0.95)",
};

export const LIGHT = {
  bg: "#f4f7fb",
  surface: "#ffffff",
  raised: "#eef2f8",
  border: "rgba(0,0,0,0.07)",
  borderHov: "rgba(0,0,0,0.16)",
  text: "#0a0f1e",
  textSec: "#1e3a5f",
  textMuted: "#4a6080",
  green: "#059669",
  blue: "#2563eb",
  amber: "#d97706",
  red: "#dc2626",
  purple: "#7c3aed",
  cyan: "#0284c7",
  overlay: "rgba(0,0,0,0.55)",
  shadow: "0 1px 4px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 28px rgba(0,0,0,0.12)",
  shadowXl: "0 20px 52px rgba(0,0,0,0.18)",
};
