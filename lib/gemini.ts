// lib/gemini.ts
// Gemini 2.0 Flash — Brain 1: Site Blueprint Architect

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function fixJsonString(s: string): string {
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  let result = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { result += c; esc = false; continue; }
    if (c === "\\") { esc = true; result += c; continue; }
    if (c === '"') { inStr = !inStr; result += c; continue; }
    if (inStr) {
      if (c === "\n") { result += "\\n"; continue; }
      if (c === "\r") { result += "\\r"; continue; }
      if (c === "\t") { result += "\\t"; continue; }
    }
    result += c;
  }
  return result;
}

function extractAndRebuild(s: string): SiteBlueprint {
  const key = '"stitchPrompt"';
  const keyIdx = s.indexOf(key);
  if (keyIdx === -1) throw new Error("No stitchPrompt key");
  const colonIdx = s.indexOf(":", keyIdx + key.length);
  const openQuote = s.indexOf('"', colonIdx + 1);
  if (openQuote === -1) throw new Error("No opening quote");
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace === -1) throw new Error("No closing brace");
  let closeQuote = -1;
  for (let i = lastBrace - 1; i > openQuote; i--) {
    if (s[i] === '"') { closeQuote = i; break; }
  }
  if (closeQuote <= openQuote) throw new Error("No closing quote");
  const rawStitch = s.slice(openQuote + 1, closeQuote);
  const safeStitch = rawStitch
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/[\x00-\x1F\x7F]/g, "");
  const rebuilt = s.slice(0, openQuote + 1) + safeStitch + s.slice(closeQuote);
  const shell = fixJsonString(rebuilt).replace(/,\s*([}\]])/g, "$1");
  const parsed = JSON.parse(shell) as SiteBlueprint;
  parsed.stitchPrompt = rawStitch.replace(/\r\n/g, "\n").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return parsed;
}

function parseGeminiJson(raw: string): SiteBlueprint {
  let s = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  try { return JSON.parse(s); } catch {}
  const cleaned = fixJsonString(s);
  try { return JSON.parse(cleaned); } catch {}
  const noTrailing = cleaned.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(noTrailing); } catch {}
  try { return extractAndRebuild(s); } catch (e: any) {
    try {
      JSON.parse(cleaned);
    } catch (d: any) {
      const pos = parseInt((d.message.match(/position (\d+)/) || [])[1] ?? "0");
      if (pos > 0) console.error(`[Gemini] Error at pos ${pos}:`, JSON.stringify(cleaned.slice(Math.max(0, pos-100), pos+100)));
    }
    throw new Error(`JSON parse failed: ${e.message}`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

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

Return exactly:
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

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  let data: any;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) { data = await res.json(); break; }
    const errText = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 3000;
      console.warn(`[Gemini] ${res.status} attempt ${attempt}/${maxAttempts}, retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no content");
  console.log("[Gemini] Raw length:", raw.length, "| first 300:", raw.slice(0, 300));

  let blueprint: SiteBlueprint;
  try {
    blueprint = parseGeminiJson(raw);
  } catch (e: any) {
    console.error("[Gemini] All parse attempts failed:", e.message);
    const title = (raw.match(/"projectTitle"\s*:\s*"([^"]+)"/) || [])[1] || "Website Project";
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
    } as SiteBlueprint;
  }

  if (!blueprint.stitchPrompt || blueprint.stitchPrompt.length < 200) {
    throw new Error(`Gemini stitchPrompt too short (${blueprint.stitchPrompt?.length ?? 0} chars)`);
  }
  if (!blueprint.projectTitle) throw new Error("Gemini blueprint missing projectTitle");

  return blueprint;
}
