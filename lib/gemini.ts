// lib/gemini.ts
// Brain 1: Site Blueprint Architect — powered by Claude
// Same interface throughout the pipeline — nothing else changes.

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

  // First attempt: standard parse
  try { return JSON.parse(s) as SiteBlueprint; } catch {}

  // Second attempt: extract stitchPrompt separately.
  // stitchPrompt is always the LAST field — so its closing quote is just before
  // the final `}` of the JSON. Scan backward from the end to find it, then
  // replace the value with a safe placeholder, parse the shell, re-attach.
  try {
    const spKey = '"stitchPrompt"';
    const spIdx = s.indexOf(spKey);
    if (spIdx !== -1) {
      const colonIdx = s.indexOf(":", spIdx + spKey.length);
      const quoteOpen = s.indexOf('"', colonIdx + 1);
      // Scan BACKWARD from the final } to find the closing quote of stitchPrompt
      let quoteClose = -1;
      for (let i = s.length - 1; i > quoteOpen; i--) {
        if (s[i] === '"' && s[i - 1] !== "\\") { quoteClose = i; break; }
      }
      if (quoteOpen !== -1 && quoteClose > quoteOpen) {
        const stitchPromptRaw = s.slice(quoteOpen + 1, quoteClose);
        const placeholder = "STITCH_PLACEHOLDER_XYZ";
        const sWithPlaceholder = s.slice(0, quoteOpen + 1) + placeholder + s.slice(quoteClose);
        const obj = JSON.parse(sWithPlaceholder) as SiteBlueprint;
        obj.stitchPrompt = stitchPromptRaw
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"');
        return obj;
      }
    }
  } catch {}

  // Third attempt: sanitise control characters and retry
  try {
    const sanitised = s.replace(/[\x00-\x1f]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      return "";
    });
    return JSON.parse(sanitised) as SiteBlueprint;
  } catch {}

  throw new Error("parseJson: all strategies failed");
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
  bookingUrl?: string;
  pricingSection: string;
  imageSection: string;
  productsWithPhotos: any[];
}): Promise<SiteBlueprint> {
  const {
    businessName, industry, targetAudience, usp, goal, style, colorPrefs,
    references, features, clientEmail, clientPhone, businessAddress,
    facebookPage, additionalNotes, pages, isMultiPage, hasBooking, bookingUrl,
    pricingSection, imageSection, productsWithPhotos,
  } = context;

  const pageList = pages.join(", ") || "Home";
  const currentYear = new Date().getFullYear();
  const iframeTag = bookingUrl ? '<iframe src=' + bookingUrl + ' width=100% height=700 frameborder=0 scrolling=auto style=display:block;background:#fff; title=BookAnAppointment loading=lazy></iframe>' : '';
  const bookingInstruction = hasBooking && bookingUrl
    ? '- Booking section id=booking - EMBED THIS EXACT IFRAME: ' + iframeTag + ' - wrap in a dark section with heading Book an Appointment'
    : hasBooking
    ? '- Booking section id=booking with a prominent Book Now call to action'
    : '';

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
4. stitchPrompt must be minimum 800 words and MUST include ALL of the following EXACTLY:

STRUCTURE (non-negotiable — these exact HTML attributes must appear):
   - header with sticky nav: logo left, desktop links right, and a button with id=hamburger class=md:hidden that toggles div with id=mobile-menu
   - div id=mobile-menu sliding drawer with all nav links duplicated, hidden by default, closed by a button with aria-label=Close menu
   - section id=hero full viewport hero with bold headline and CTA button that scrolls to booking
   - section id=services services grid
   - section id=testimonials with 3+ Australian names and 5-star ratings
   - section id=faq accordion with 6+ Q&A pairs
   - section id=contact with working form, real email ${clientEmail}, real phone ${clientPhone}
   - footer with copyright ${currentYear} ${businessName}
   ${bookingInstruction}
   ${isMultiPage ? "- Each page is a div with class=page-section and a unique id matching the page name. Nav links have onclick calling window.navigateTo with the page id." : "- Single page: nav links scroll to section ids smoothly"}
   ${features.includes("Photo Gallery") ? "- section id=gallery" : ""}
   ${features.includes("Payments / Shop") && productsWithPhotos.length > 0 ? "- section id=shop with class=wg-buy-btn on product cards" : ""}

CONTENT:
   - Exact business name: ${businessName}
   - Exact contact: email ${clientEmail}, phone ${clientPhone}${businessAddress ? ", address: " + businessAddress : ""}
   - Colour palette with hex codes
   - Google Fonts to use
   - Stats bar with 3-4 numbers relevant to ${industry}

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
