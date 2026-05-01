// lib/gemini.ts
// Brain 1: Site Blueprint Architect — now powered by Claude (Gemini free tier too limited)
// Same interface as before — drop-in replacement, nothing else in the pipeline changes.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface SiteBlueprint {
  projectTitle: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    heroSize: string;
  };
  sections: string[];
  tone: string;
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  uniqueDesignIdea: string;
  stitchPrompt: string;
}

function parseJson(raw: string): SiteBlueprint {
  let s = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/m, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s) as SiteBlueprint;
}

export async function generateSiteBlueprint(context: {
  businessName: string;
  industry: string;
  targetAudience: string;
  usp: string;
  goal: string;
  style: string;
  colorPrefs: string;
  references: string;
  features: string[];
  clientEmail: string;
  clientPhone: string;
  businessAddress: string;
  facebookPage: string;
  additionalNotes: string;
  pages: string[];
  isMultiPage: boolean;
  hasBooking: boolean;
  pricingSection: string;
  imageSection: string;
  productsWithPhotos: any[];
}): Promise<SiteBlueprint> {
  const {
    businessName, industry, targetAudience, usp, goal, style, colorPrefs,
    references, features, clientEmail, clientPhone, businessAddress,
    facebookPage, additionalNotes, pages, isMultiPage, hasBooking,
    pricingSection, imageSection, productsWithPhotos,
  } = context;

  const pageList = pages.join(", ") || "Home";
  const currentYear = new Date().getFullYear();

  const prompt = `You are a world-class web design architect producing a Site Blueprint JSON.

BUSINESS BRIEF:
- Business Name: ${businessName}
- Industry: ${industry}
- Target Audience: ${targetAudience || "general public"}
- Unique Selling Point: ${usp || "quality service"}
- Primary Goal: ${goal}
- Preferred Style: ${style || "modern premium"}
- Colour Preferences: ${colorPrefs || "professional palette"}
- Reference Sites: ${references || "none"}
- Features Required: ${features.join(", ") || "contact form"}
- Contact Email: ${clientEmail}
- Contact Phone: ${clientPhone}
- Business Address: ${businessAddress || "not provided"}
- Facebook: ${facebookPage || "none"}
- Pages: ${pageList}
- Site Type: ${isMultiPage ? "multi-page" : "single-page"}
- Booking System: ${hasBooking ? "YES - include id=booking section" : "no"}
- Pricing: ${pricingSection}
- Images: ${imageSection}
- Additional Notes: ${additionalNotes || "none"}

CRITICAL RULES:
1. Respond ONLY with a valid JSON object - no markdown, no backticks, no explanation
2. Start with { and end with }
3. Inside ALL string values use only single quotes, never raw double quotes
4. stitchPrompt must be minimum 800 words and MUST include:
   - Exact business name: ${businessName}
   - Exact contact: email ${clientEmail}, phone ${clientPhone}${businessAddress ? ", address: " + businessAddress : ""}
   - Colour palette with hex codes
   - Google Fonts to use
   - Hero: full viewport, bold headline 60-80px, subheadline, CTA button
   - Sticky nav: logo left, links right, hamburger id=hamburger toggling id=mobile-menu
   - Stats bar with 3-4 numbers
   - Services section
   - Testimonials id=testimonials with 3+ Australian names, 5-star ratings
   - FAQ accordion id=faq with 6+ Q&A pairs
   - Contact id=contact with form, real email, real phone
   - Footer copyright ${currentYear}
   ${hasBooking ? "- Booking section id=booking" : ""}
   ${isMultiPage ? "- MULTI-PAGE: div.page-section per page, nav onclick=navigateTo" : "- SINGLE PAGE: smooth scroll href=#sectionid"}
   ${features.includes("Photo Gallery") ? "- Gallery id=gallery" : ""}
   ${features.includes("Payments / Shop") && productsWithPhotos.length > 0 ? "- Shop id=shop with class=wg-buy-btn on product cards" : ""}

Return exactly this JSON shape (no other text):
{
  "projectTitle": "...",
  "palette": {"primary":"#hex","accent":"#hex","background":"#hex","surface":"#hex","text":"#hex"},
  "typography": {"headingFont":"Name","bodyFont":"Name","heroSize":"72px"},
  "sections": ["hero","about","services","testimonials","faq","contact"],
  "tone": "...",
  "heroHeadline": "...",
  "heroSubheadline": "...",
  "ctaText": "...",
  "uniqueDesignIdea": "...",
  "stitchPrompt": "minimum 800 words, single quotes only inside"
}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  if (!raw) throw new Error("Blueprint: no content returned");
  console.log("[Blueprint] Raw length:", raw.length, "| first 200:", raw.slice(0, 200));

  let blueprint: SiteBlueprint;
  try {
    blueprint = parseJson(raw);
  } catch (e: any) {
    console.error("[Blueprint] JSON parse failed:", e.message);
    // Regex fallback — extract what we can
    const title = (raw.match(/"projectTitle"\s*:\s*"([^"]+)"/) || [])[1] || businessName + " Website";
    const stitchIdx = raw.indexOf('"stitchPrompt"');
    const stitchOpen = stitchIdx !== -1 ? raw.indexOf('"', raw.indexOf(":", stitchIdx) + 1) : -1;
    const stitchClose = stitchOpen !== -1 ? raw.lastIndexOf('"', raw.lastIndexOf("}") - 1) : -1;
    const stitchPrompt = (stitchOpen !== -1 && stitchClose > stitchOpen)
      ? raw.slice(stitchOpen + 1, stitchClose)
      : raw.slice(0, 4000);
    blueprint = {
      projectTitle: title,
      palette: { primary: "#1a1a2e", accent: "#00c896", background: "#0a0f1a", surface: "#0f1623", text: "#e2e8f0" },
      typography: { headingFont: "Inter", bodyFont: "Inter", heroSize: "72px" },
      sections: ["hero", "about", "services", "testimonials", "faq", "contact"],
      tone: "professional and modern",
      heroHeadline: title,
      heroSubheadline: "Premium quality service",
      ctaText: "Get Started",
      uniqueDesignIdea: "Clean modern design with bold typography",
      stitchPrompt,
    };
  }

  if (!blueprint.stitchPrompt || blueprint.stitchPrompt.length < 200) {
    throw new Error(`Blueprint stitchPrompt too short (${blueprint.stitchPrompt?.length ?? 0} chars)`);
  }
  if (!blueprint.projectTitle) throw new Error("Blueprint missing projectTitle");

  console.log(`[Blueprint] Done: "${blueprint.projectTitle}" — stitch prompt ${blueprint.stitchPrompt.length} chars`);
  return blueprint;
}
