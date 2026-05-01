// lib/gemini.ts
// Gemini 1.5 Pro — Brain 1: Site Blueprint Architect
// Produces a structured SiteBlueprint JSON that drives the entire build.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface SiteBlueprint {
  projectTitle: string;
  palette: {
    primary: string;    // hex — dominant brand colour
    accent: string;     // hex — CTA / highlight colour
    background: string; // hex — main background
    surface: string;    // hex — card/section background
    text: string;       // hex — body text
  };
  typography: {
    headingFont: string; // Google Font name
    bodyFont: string;    // Google Font name
    heroSize: string;    // e.g. "72px"
  };
  sections: string[];    // ordered list of section ids, e.g. ["hero","about","services","testimonials","faq","contact"]
  tone: string;          // e.g. "premium and authoritative" | "warm and approachable"
  heroHeadline: string;  // exact headline text for the hero
  heroSubheadline: string;
  ctaText: string;       // CTA button label, e.g. "Book a Free Consult"
  uniqueDesignIdea: string; // one distinctive visual idea to make the site stand out
  stitchPrompt: string;  // full detailed prompt for Stitch (Brain 2) to generate the HTML
}

// ─── Robust JSON parser ──────────────────────────────────────────────────────
// Gemini sometimes returns malformed JSON: unescaped control chars, literal
// newlines inside strings, markdown fences, preamble text, or truncated output.
// This tries several strategies in order before giving up.
function parseGeminiJson(raw: string): SiteBlueprint {
  // Strategy 1: try parsing the raw response directly (works if Gemini behaved)
  try { return JSON.parse(raw); } catch {}

  // Strip markdown fences
  let s = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  // Strategy 2: try after fence strip
  try { return JSON.parse(s); } catch {}

  // Extract the outermost {...} block
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);

  // Strategy 3: try after extraction
  try { return JSON.parse(s); } catch {}

  // Remove ASCII control characters (except \t \n \r which we handle next)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Strategy 4: try after control char removal
  try { return JSON.parse(s); } catch {}

  // Fix literal (unescaped) newlines and tabs that appear inside JSON string values.
  // We walk character by character to avoid corrupting already-escaped sequences.
  s = fixLiteralWhitespaceInStrings(s);

  // Strategy 5: try after whitespace fix
  try { return JSON.parse(s); } catch {}

  // Strategy 6: remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(s); } catch (e: any) {
    throw new Error(`JSON parse failed after all strategies: ${e.message}`);
  }
}

/** Walk the JSON string and escape any literal \n or \t that appear inside a JSON string value */
function fixLiteralWhitespaceInStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }
  return result;
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

  const prompt = `You are a world-class web design architect. Your job is to produce a precise Site Blueprint JSON for a premium website build.

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
- Booking System: ${hasBooking ? "YES — include id='booking' section" : "no"}
- Pricing: ${pricingSection}
- Images: ${imageSection}
- Additional Notes: ${additionalNotes || "none"}

CRITICAL RULES FOR YOUR RESPONSE:
1. Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation
2. Start with { and end with }
3. The "stitchPrompt" field must be a comprehensive, detailed design brief (minimum 800 words) that Brain 2 will use to generate the complete HTML/CSS
4. The stitchPrompt MUST include all of the following:
   - EXACT business name: "${businessName}" — used everywhere, never a placeholder
   - EXACT contact details: email ${clientEmail}, phone ${clientPhone}${businessAddress ? `, address: ${businessAddress}` : ""}
   - Precise colour palette with hex codes
   - Specific Google Fonts to use
   - Hero section: full viewport, bold headline (60-80px), subheadline, CTA button
   - Sticky nav with logo left, links right, mobile hamburger id="hamburger" toggling id="mobile-menu"
   - Stats bar with 3-4 impressive numbers
   - Services/features section
   - Testimonials section id="testimonials" with 3+ Australian names, 5-star ratings ★★★★★
   - FAQ accordion section id="faq" with 6+ relevant Q&A pairs
   - Contact section id="contact" with form + real email + real phone
   - Footer with copyright ${currentYear}
   ${hasBooking ? `- Booking section with id="booking" (widget injected here)` : ""}
   ${isMultiPage ? `- MULTI-PAGE: Each page is a div.page-section with unique id, only first visible, nav uses onclick="navigateTo('id')"` : "- SINGLE PAGE: smooth scroll nav with href='#sectionid'"}
   ${features.includes("Photo Gallery") ? `- Gallery section id="gallery"` : ""}
   ${features.includes("Payments / Shop") && productsWithPhotos.length > 0 ? `- Shop section id="shop" with product cards having class="wg-buy-btn"` : ""}
   - One distinctive visual idea that makes this site stand out from competitors

Return this exact JSON structure:
{
  "projectTitle": "short descriptive title",
  "palette": {
    "primary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode",
    "surface": "#hexcode",
    "text": "#hexcode"
  },
  "typography": {
    "headingFont": "Font Name",
    "bodyFont": "Font Name",
    "heroSize": "72px"
  },
  "sections": ["hero", "about", "services", "testimonials", "faq", "contact"],
  "tone": "describe the tone",
  "heroHeadline": "exact headline",
  "heroSubheadline": "exact subheadline",
  "ctaText": "CTA button label",
  "uniqueDesignIdea": "one distinctive visual concept",
  "stitchPrompt": "full detailed prompt minimum 800 words..."
}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  // Retry up to 4 times on 429/503 with exponential backoff
  let data: any;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      data = await res.json();
      break;
    }

    const errText = await res.text();

    // Retryable: 429 rate limit or 503 overload
    if ((res.status === 429 || res.status === 503) && attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 3000; // 6s, 12s, 24s
      console.warn(`[Gemini] ${res.status} on attempt ${attempt}/${maxAttempts}, retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no content");

  console.log("[Gemini] Raw response length:", raw.length, "| first 500:", raw.slice(0, 500));

  let blueprint: SiteBlueprint;
  try {
    blueprint = parseGeminiJson(raw);
  } catch (e: any) {
    console.error("[Gemini] All parse attempts failed:", e.message);
    // Last-resort fallback — extract just title and stitchPrompt via regex
    const title = raw.match(/"projectTitle"\s*:\s*"([^"]+)"/)?.[1] || "Website Project";
    const stitchMatch = raw.match(/"stitchPrompt"\s*:\s*"([\s\S]{200,}?)"\s*[,}]/);
    const stitchPrompt = stitchMatch?.[1]?.replace(/\\n/g, "\n").replace(/\\t/g, "\t") || raw.slice(0, 4000);
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
    throw new Error(`Gemini blueprint stitchPrompt too short (${blueprint.stitchPrompt?.length ?? 0} chars)`);
  }
  if (!blueprint.projectTitle) throw new Error("Gemini blueprint missing projectTitle");

  return blueprint;
}
