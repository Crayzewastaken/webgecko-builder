// lib/blueprint.ts
// Brain 1: Site Blueprint Architect — powered by Claude Haiku
// Includes SERP intelligence (fetch top-3 structure) and keyword clustering.

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
  // SEO additions
  lsiKeywords?: string[];
  serpInsights?: SerpInsights;
}

export interface SerpInsights {
  avgWordCount: number;
  avgH2Count: number;
  topHeadings: string[];
  winningStructure: string;
}

// ── SERP Intelligence ─────────────────────────────────────────────────────────
// Fetches top Google results for "<businessName> <industry> <city>" and
// extracts structural signals (heading count, word count, H2 text) to
// inform the stitch prompt so generated content matches what Google rewards.

async function fetchSerpInsights(
  businessName: string,
  industry: string,
  location: string,
): Promise<SerpInsights | null> {
  if (!process.env.SERPER_API_KEY) {
    console.log("[Blueprint] SERPER_API_KEY not set — skipping SERP intelligence");
    return null;
  }

  const query = `${industry} ${location}`.trim();
  console.log(`[Blueprint] SERP query: "${query}"`);

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 3, gl: "au" }),
    });
    if (!res.ok) {
      console.warn(`[Blueprint] Serper API ${res.status} — skipping SERP`);
      return null;
    }
    const data = await res.json() as { organic?: { title: string; link: string; snippet: string }[] };
    const results = data.organic?.slice(0, 3) || [];

    if (results.length === 0) return null;

    // Extract structural signals from snippets (we don't fetch full pages to keep latency low)
    // Use Claude Haiku to synthesise what these top results suggest about structure
    const snippetSummary = results.map((r, i) =>
      `Result ${i + 1}: "${r.title}"\n${r.snippet}`
    ).join("\n\n");

    const analysisRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // Haiku is fine for this lightweight SERP JSON extraction
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are an SEO analyst. Based on these top Google search results for "${query}", extract:
1. Estimated average word count for these pages (guess from snippet density: short=300, medium=800, long=1500+)
2. Estimated average number of H2 headings (guess: few=3, moderate=6, many=10+)
3. The 4 most common heading themes/topics across the results
4. A one-sentence description of the winning content structure

Results:
${snippetSummary}

Respond ONLY with JSON: {"avgWordCount":N,"avgH2Count":N,"topHeadings":["h1","h2","h3","h4"],"winningStructure":"..."}`,
      }],
    });

    const raw = analysisRes.content[0]?.type === "text" ? analysisRes.content[0].text : "";
    const cleaned = raw.replace(/```json\s*/i, "").replace(/```/g, "").trim();
    const insights = JSON.parse(cleaned) as SerpInsights;
    console.log(`[Blueprint] SERP insights: avgWords=${insights.avgWordCount} avgH2=${insights.avgH2Count}`);
    return insights;
  } catch (e) {
    console.warn("[Blueprint] SERP fetch failed (non-fatal):", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ── LSI Keyword Clustering ─────────────────────────────────────────────────────
// Generates 12–15 semantically related keywords for the business/industry/location
// combo. These get woven into the stitchPrompt so the generated page ranks for
// long-tail variations without extra pages.

async function generateLsiKeywords(
  businessName: string,
  industry: string,
  location: string,
  usp: string,
): Promise<string[]> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Generate 12-15 LSI and long-tail keywords for a local business website.

Business: ${businessName}
Industry: ${industry}
Location: ${location}
USP: ${usp}

Rules:
- Mix primary, secondary, and long-tail variations
- Include location-based variants (suburb, city, state)
- Include service-specific variants
- Include intent variants ("near me", "best", "affordable", "emergency", "24 hour" where relevant)
- No generic filler — every keyword must be something a real customer would search

Respond ONLY with a JSON array of strings: ["keyword1","keyword2",...]`,
      }],
    });
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const cleaned = raw.replace(/```json\s*/i, "").replace(/```/g, "").trim();
    const keywords = JSON.parse(cleaned) as string[];
    console.log(`[Blueprint] LSI keywords (${keywords.length}): ${keywords.slice(0, 5).join(", ")}…`);
    return keywords;
  } catch (e) {
    console.warn("[Blueprint] LSI generation failed (non-fatal):", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ── JSON parser ────────────────────────────────────────────────────────────────

/**
 * Pre-sanitize: find the stitchPrompt string value and escape any bare double-quotes
 * inside it. Haiku/Sonnet sometimes outputs HTML attr="value" inside the JSON string
 * without escaping, breaking all parse attempts downstream.
 *
 * Scans FORWARD from the opening quote so CSS `}` characters don't confuse us.
 */
function escapeStitchPromptQuotes(s: string): string {
  const spKey = '"stitchPrompt"';
  const spIdx = s.indexOf(spKey);
  if (spIdx === -1) return s;
  const colonIdx = s.indexOf(":", spIdx + spKey.length);
  if (colonIdx === -1) return s;

  // Skip whitespace to find the opening `"` of the value
  let vStart = colonIdx + 1;
  while (vStart < s.length && s[vStart] !== '"') vStart++;
  if (vStart >= s.length) return s;

  // Scan forward character by character to find the real closing quote.
  // A closing quote is one that is immediately followed by optional whitespace
  // then a `,`, `}`, or end-of-object. We escape all others.
  let out = s.slice(0, vStart + 1); // everything up to and including the opening "
  let i = vStart + 1;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      // Already escaped sequence — copy both chars unchanged
      out += ch + s[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      // Peek ahead (skip whitespace) to see if this terminates the JSON value
      let j = i + 1;
      while (j < s.length && (s[j] === " " || s[j] === "\t" || s[j] === "\r" || s[j] === "\n")) j++;
      if (j >= s.length || s[j] === "," || s[j] === "}") {
        // Real closing quote — append rest of string as-is and return
        out += s.slice(i);
        return out;
      }
      // Unescaped interior quote — escape it
      out += '\\"';
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function parseJson(raw: string): SiteBlueprint {
  // Strip code fences — handle both wrapped and inline fence styles
  let s = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/gm, "")
    .trim();

  // Find first { then walk forward counting braces to find the real outermost }
  // (lastIndexOf("}") is wrong when stitchPrompt contains CSS/HTML with } chars)
  const first = s.indexOf("{");
  let extracted = s;
  if (first !== -1) {
    let depth = 0;
    let inString = false;
    let escaping = false;
    let last = -1;
    for (let i = first; i < s.length; i++) {
      const ch = s[i];
      if (escaping) { escaping = false; continue; }
      if (ch === "\\" && inString) { escaping = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { last = i; break; } }
    }
    if (last !== -1) extracted = s.slice(first, last + 1);
    else extracted = s.slice(first); // truncated — try anyway
  }

  // Strategy 0: control-character sanitization first (newlines inside strings break JSON.parse)
  let extracted0 = extracted;
  try {
    extracted0 = extracted.replace(/[\x00-\x1f]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      return "";
    });
  } catch {}

  // Strategy 1: vanilla parse of brace-extracted JSON (with control chars sanitized)
  try { return JSON.parse(extracted0) as SiteBlueprint; } catch {}
  try { return JSON.parse(extracted) as SiteBlueprint; } catch {}

  // Strategy 2: fix unescaped double-quotes inside stitchPrompt, then parse
  try {
    const sanitised2 = escapeStitchPromptQuotes(extracted0);
    return JSON.parse(sanitised2) as SiteBlueprint;
  } catch {}
  try {
    const sanitised2 = escapeStitchPromptQuotes(extracted);
    return JSON.parse(sanitised2) as SiteBlueprint;
  } catch {}

  // Strategy 3: placeholder-swap to surgically extract stitchPrompt
  try {
    const spKey = '"stitchPrompt"';
    const spIdx = extracted.indexOf(spKey);
    if (spIdx !== -1) {
      const colonIdx = extracted.indexOf(":", spIdx + spKey.length);
      const quoteOpen = extracted.indexOf('"', colonIdx + 1);
      // Scan FORWARD for real closing quote (not backward — CSS } chars break backward scan)
      let quoteClose = -1;
      let i = quoteOpen + 1;
      while (i < extracted.length) {
        if (extracted[i] === "\\" && i + 1 < extracted.length) { i += 2; continue; }
        if (extracted[i] === '"') {
          let j = i + 1;
          while (j < extracted.length && (extracted[j] === " " || extracted[j] === "\t" || extracted[j] === "\r" || extracted[j] === "\n")) j++;
          if (j >= extracted.length || extracted[j] === "," || extracted[j] === "}") { quoteClose = i; break; }
        }
        i++;
      }
      if (quoteOpen !== -1 && quoteClose > quoteOpen) {
        const stitchPromptRaw = extracted.slice(quoteOpen + 1, quoteClose);
        const placeholder = "STITCH_PLACEHOLDER_XYZ";
        const sWithPlaceholder = extracted.slice(0, quoteOpen + 1) + placeholder + extracted.slice(quoteClose);
        const obj = JSON.parse(sWithPlaceholder) as SiteBlueprint;
        obj.stitchPrompt = stitchPromptRaw
          .replace(/\\n/g, "\n").replace(/\\t/g, "\t")
          .replace(/\\'/g, "'").replace(/\\"/g, '"');
        return obj;
      }
    }
  } catch {}

  // Strategy 4: control-character sanitization
  try {
    const sanitised = extracted.replace(/[\x00-\x1f]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      return "";
    });
    return JSON.parse(sanitised) as SiteBlueprint;
  } catch {}

  // Strategy 5: strip stitchPrompt entirely, parse rest, then re-extract via forward scan
  try {
    const noStitch = extracted.replace(/"stitchPrompt"\s*:\s*"(?:[^"\\]|\\.)*"/g, '"stitchPrompt":""');
    const obj = JSON.parse(noStitch) as SiteBlueprint;
    // Re-extract stitchPrompt using the same forward-scan as escapeStitchPromptQuotes
    const spKey5 = '"stitchPrompt"';
    const spIdx5 = extracted.indexOf(spKey5);
    if (spIdx5 !== -1) {
      const colon5 = extracted.indexOf(":", spIdx5 + spKey5.length);
      let vStart5 = colon5 + 1;
      while (vStart5 < extracted.length && extracted[vStart5] !== '"') vStart5++;
      if (vStart5 < extracted.length) {
        let i5 = vStart5 + 1, closeIdx5 = -1;
        while (i5 < extracted.length) {
          if (extracted[i5] === "\\" && i5 + 1 < extracted.length) { i5 += 2; continue; }
          if (extracted[i5] === '"') {
            let j5 = i5 + 1;
            while (j5 < extracted.length && (extracted[j5] === " " || extracted[j5] === "\t" || extracted[j5] === "\r" || extracted[j5] === "\n")) j5++;
            if (j5 >= extracted.length || extracted[j5] === "," || extracted[j5] === "}") { closeIdx5 = i5; break; }
          }
          i5++;
        }
        if (closeIdx5 > vStart5) {
          obj.stitchPrompt = extracted.slice(vStart5 + 1, closeIdx5)
            .replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
        }
      }
    }
    return obj;
  } catch {}

  // Strategy 6: log what we actually got to help debug
  console.error("[Blueprint] All parse strategies failed. extracted[:500]:", extracted.slice(0, 500));
  throw new Error("parseJson: all strategies failed");
}

// ── Main export ───────────────────────────────────────────────────────────────

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
  productsWithPhotos: { name: string; price: string; photoUrl?: string }[];
  instagramUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
  realTestimonials?: string;
  blogTopics?: string;
  videoUrl?: string;
  shopProducts?: string;
  exampleHtmls?: { label: string; html: string }[];
}): Promise<SiteBlueprint> {
  const {
    businessName, industry, targetAudience, usp, goal, style, colorPrefs,
    references, features, clientEmail, clientPhone, businessAddress,
    facebookPage, additionalNotes, pages, isMultiPage, hasBooking, bookingUrl,
    pricingSection, imageSection, productsWithPhotos,
    instagramUrl, linkedinUrl, tiktokUrl, realTestimonials, blogTopics, videoUrl, shopProducts,
    exampleHtmls = [],
  } = context;

  // Extract suburb/city from address for SERP + LSI — never use the full street address.
  // "9 kondalilla parade forest lake" → "forest lake"
  // "123 Main St, Brisbane QLD 4000" → "Brisbane QLD"
  const location = (() => {
    if (!businessAddress) return "Australia";
    const parts = businessAddress.split(",");
    if (parts.length >= 2) {
      return parts.slice(-2).join(",").trim().replace(/\s*\d{4}\s*$/, "").trim();
    }
    // No commas — strip leading number and street-type words, keep suburb/city at the end
    const cleaned = businessAddress
      .replace(/^\d+[a-zA-Z]?\s+/, "")
      .replace(/\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|court|ct|way|lane|ln|boulevard|blvd|crescent|cres|close|circuit|cct|highway|hwy|terrace|tce|grove|gr|rise|row|square|sq|walk|track)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const words = cleaned.split(/\s+/).filter((w: string) => w.length > 1);
    return words.slice(-2).join(" ") || businessAddress;
  })();

  // ── Pre-step A: SERP intelligence + LSI keywords (parallel, non-blocking) ──
  const [serpInsights, lsiKeywords] = await Promise.all([
    fetchSerpInsights(businessName, industry, location),
    generateLsiKeywords(businessName, industry, location, usp),
  ]);

  const pageList = pages.join(", ") || "Home";
  const currentYear = new Date().getFullYear();
  const iframeTag = bookingUrl
    ? `<iframe src=${bookingUrl} width=100% height=700 frameborder=0 scrolling=auto style=display:block;background:#fff; title=BookAnAppointment loading=lazy></iframe>`
    : "";
  const bookingInstruction = hasBooking && bookingUrl
    ? "- Booking section id=booking - EMBED THIS EXACT IFRAME: " + iframeTag + " - wrap in a dark section with heading Book an Appointment"
    : hasBooking
    ? "- Booking section id=booking with a prominent Book Now call to action"
    : "";

  // ── SERP-informed content guidance ───────────────────────────────────────────
  const serpGuidance = serpInsights
    ? `
SEO INTELLIGENCE (from top-ranking pages for "${industry} ${location}"):
- Target content depth: ~${serpInsights.avgWordCount} words across all sections
- Use approximately ${serpInsights.avgH2Count} H2 headings total
- Winning H2 themes to incorporate: ${serpInsights.topHeadings.join(", ")}
- Winning structure: ${serpInsights.winningStructure}
`
    : "";

  // ── LSI keyword instruction ────────────────────────────────────────────────
  const lsiInstruction = lsiKeywords.length > 0
    ? `
KEYWORD STRATEGY — weave these naturally throughout all sections (do NOT list them, use organically):
${lsiKeywords.join(", ")}
Primary keyword placement: weave "${industry} ${location.split(",")[0]?.trim()}" naturally into the services or intro section — NOT in the hero headline or hero subheadline.
`
    : "";

  // ── Fixed section scaffold — Stitch receives exact HTML structure, only styling/content varies ──
  const navPages = isMultiPage
    ? pages.map(p => `<a href='#' onclick='navigateTo(\"${p.toLowerCase().replace(/\s+/g,"-")}\")'>${p}</a>`).join(" ")
    : ["Home","Services","About","Testimonials","FAQ","Contact"].map(p => `<a href='#${p.toLowerCase()}'>${p}</a>`).join(" ");

  const contactFormScaffold = `<form id='contact-form' onsubmit='event.preventDefault();this.style.display=\"none\";document.getElementById(\"contact-success\").style.display=\"block\"'>
  <div style='display:grid;gap:14px'>
    <input type='text' name='name' placeholder='Full Name' required style='width:100%;padding:14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-size:1rem;outline:none;box-sizing:border-box'>
    <input type='email' name='email' placeholder='Email Address' required style='width:100%;padding:14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-size:1rem;outline:none;box-sizing:border-box'>
    <input type='tel' name='phone' placeholder='Phone Number' style='width:100%;padding:14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-size:1rem;outline:none;box-sizing:border-box'>
    <textarea name='message' placeholder='Message' rows='4' style='width:100%;padding:14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-size:1rem;outline:none;resize:vertical;box-sizing:border-box'></textarea>
    <button type='submit' style='width:100%;padding:16px;border-radius:8px;background:ACCENT;color:#fff;font-size:1rem;font-weight:700;border:none;cursor:pointer'>Send Message</button>
  </div>
</form>
<div id='contact-success' style='display:none;text-align:center;padding:40px 20px'>
  <div style='font-size:2rem;margin-bottom:12px'>✓</div>
  <p style='font-size:1.1rem;font-weight:600'>Message sent! We will be in touch shortly.</p>
</div>`;

  const ctaText = hasBooking ? "Book Now" : goal?.toLowerCase().includes("quote") ? "Get a Quote" : "Get Started";
  const heroUrl = videoUrl || "";

  // ── Industry-specific extra sections ─────────────────────────────────────────
  // These are injected into the scaffold after [4] SERVICES for industries that
  // benefit from additional standard sections. Keeps the generic scaffold lean
  // while ensuring high-value industries get full depth.
  const industryLower = industry.toLowerCase();
  const extraSections: string[] = [];

  if (/web.*(design|agenc|develop|build|studio)|digital.*agenc|seo.*agenc|marketing.*agenc/i.test(industryLower) || /agenc|studio/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=process — "How It Works" — numbered step cards (at least 4 steps) showing the agency's process from brief to launch. Each step: number badge, title, 2-sentence description. Use the actual process: Discovery → Design → Build → Launch (or similar).`,
      `[4b] SECTION id=pricing — "Simple, Transparent Pricing" — 3 pricing tier cards side by side. Middle card is highlighted as "Most Popular". Each card: tier name, price (monthly or one-off), bullet list of 5-6 inclusions, CTA button. Use realistic pricing for ${industry} in Australia.`,
      `[4c] SECTION id=features — "Everything You Need" — icon grid (6 features minimum, 3-per-row grid). Each: icon emoji, feature title, 1-sentence description. Highlight the platform's key capabilities.`,
    );
  } else if (/restaurant|cafe|bar|food|pizza|burger|sushi|bakery/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=menu — "Our Menu" — 3 category tabs or sections (e.g. Starters, Mains, Desserts) each with 4-6 menu item cards showing name, description, price.`,
      `[4b] SECTION id=gallery — "Food Gallery" — masonry or grid of 6 food photo placeholders with appetising descriptions.`,
    );
  } else if (/plumb|electr|hvac|build|construct|trade|roof|paint|carpet|flooring/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=process — "Our Process" — 4-step numbered cards: Request Quote → Schedule Visit → Complete Work → Final Inspection. Each with icon and 2-sentence description.`,
      `[4b] SECTION id=areas — "Areas We Service" — grid of suburb/area chips or cards listing 8-10 service areas around ${location}.`,
    );
  } else if (/dentist|doctor|medical|clinic|health|physio|chiro|optom/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=process — "Your First Visit" — 3-step cards: Book Online → Consultation → Treatment Plan. Clean, reassuring copy.`,
      `[4b] SECTION id=team — "Meet Our Team" — 2-4 staff cards with name, title, and brief bio. Use professional headshot placeholders.`,
    );
  } else if (/law|legal|solicitor|barrister|attorney/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=process — "How We Work" — 4-step process: Initial Consultation → Case Assessment → Strategy → Resolution.`,
      `[4b] SECTION id=results — "Our Track Record" — 3-4 stat blocks (cases won, years experience, clients served, success rate).`,
    );
  } else if (/real.?estate|property|agent|realt/i.test(industryLower)) {
    extraSections.push(
      `[4a] SECTION id=listings — "Featured Listings" — 3 property cards with placeholder image, address, bed/bath/car icons, price.`,
      `[4b] SECTION id=process — "Selling or Buying?" — 2-column split with 4-step process for each.`,
    );
  }

  const extraSectionsScaffold = extraSections.length > 0
    ? "\n" + extraSections.join("\n\n") + "\n"
    : "";

  const prompt = `You are a world-class web designer. Produce a Site Blueprint JSON for this business.

BUSINESS:
- Name: ${businessName}
- Industry: ${industry}
- USP: ${usp || "quality service"}
- Goal: ${goal}
- Style: ${style || "modern premium"}
- Colours: ${colorPrefs || "professional palette"}
- Email: ${clientEmail} | Phone: ${clientPhone}
- Address (contact section ONLY, NEVER in hero): ${businessAddress || "not provided"}
- Social: ${[facebookPage && `Facebook:${facebookPage}`, instagramUrl && `Instagram:${instagramUrl}`, linkedinUrl && `LinkedIn:${linkedinUrl}`].filter(Boolean).join(", ") || "none"}
- Features: ${features.join(", ") || "contact form"}
- Pricing: ${pricingSection}
- Images: ${imageSection}
- Notes: ${additionalNotes || "none"}
- Client content brief: ${(context as any).businessDescription || "not provided"}
${serpGuidance}${lsiInstruction}

CRITICAL VISUAL, COMPOSITION & CODE RULES — the stitchPrompt MUST enforce ALL of these:
A. COMPOSITION OVER TEMPLATES: Abandon generic blank-canvas layouts. Every section must use intentional visual compositions:
   - HERO SECTION: Must use a gorgeous asymmetrical 50/50 split-screen on desktop. Left side: sticky vertical stack with a custom badge, hero text, and a horizontal statistics/social-proof bar. Right side: a visually striking interactive mockup, floating cards/pills (positioned absolutely), or an SVG/HTML canvas/image composition using the specified hero/logo URLs.
   - ABOUT SECTION: Must use an asymmetrical 50/50 split-screen. Left side: a sticky 600px tall featured image card/collage. Right side: vertical stack for copy and 3 compact list cards detailing the key value metrics.
   - SERVICES SECTION: Must be rendered as an asymmetrical 3-column Bento Grid (where some columns span 2 units or have different grid row alignments). Each bento card should have a 1px border, padding, and subtle micro-interactions on hover.
B. SPACING GRID (Strict 8px System): Base all spacing, paddings, margins, and gaps on an exact 8px incremental scale. Specify exact values:
   - Desktop section padding: exactly 80px top/bottom, 48px left/right.
   - Grid gaps: exactly 24px (gap-6) or 32px (gap-8).
   - Inner card padding: exactly 24px (p-6) or 32px (p-8).
   - Element margins: exactly 16px (m-4) or 32px (m-8). Never use generic or loose padding.
C. TYPOGRAPHY SCALING: Enforce absolute typographic hierarchy. Set exact heading rules:
   - Hero Heading: Must be exactly 4.5rem on desktop, using 'Space Grotesk' with line-height 1.1 and letter-spacing -0.02em.
   - H2 Section Headings: Must be exactly 2.5rem, bold, with line-height 1.25 and letter-spacing -0.01em.
   - Body Copy: Must be exactly 1.1rem, line-height 1.6, using 'Inter' font family.
D. FONTS: Import and use ONLY 'Space Grotesk' (headings h1-h3) and 'Inter' (body, nav, buttons, forms) from Google Fonts. Never use Arial, Helvetica, system-ui, or any other font.
E. BUTTONS — ALL buttons on ALL pages must be identical (use the palette.accent colour from this blueprint for ACCENT):
   - Primary: background:ACCENT;color:#fff;padding:14px 28px;border-radius:8px;font-weight:600;font-size:1rem;border:none;cursor:pointer;transition:opacity 0.2s,transform 0.15s;
   - Primary hover: opacity:0.88;transform:translateY(-1px);
   - Ghost/secondary: background:transparent;border:1.5px solid ACCENT;color:ACCENT;padding:13px 27px;border-radius:8px;font-weight:600;font-size:1rem;cursor:pointer;transition:background 0.2s;
   - Ghost hover: background:ACCENT with 13% opacity;
   - NEVER use different button styles on different pages. Copy these exact styles verbatim.
F. CARDS — ALL cards on ALL pages must be identical (SURFACE = palette.surface colour):
   - background:SURFACE;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:28px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.18);transition:box-shadow 0.2s,transform 0.2s;
   - Card hover: box-shadow:0 8px 40px rgba(0,0,0,0.28);transform:translateY(-2px);
G. NAV — The sticky header must be IDENTICAL on every page (BG = palette.background colour):
   - position:sticky;top:0;z-index:100;background:BG with e8 alpha;backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.07);padding:0 48px;height:68px;display:flex;align-items:center;justify-content:space-between;
   - Active nav link: color:ACCENT;font-weight:700;border-bottom:2px solid ACCENT;
   - Nav links call window.navigateTo('pageid') — never use href anchors for page navigation
H. COLOUR VARIABLES: Use these CSS vars everywhere — define at :root using the palette colours from this blueprint:
   --clr-bg, --clr-surface, --clr-accent, --clr-text, --clr-border:rgba(255,255,255,0.08)
I. INTERACTIONS: All nav buttons use window.navigateTo('pageid'). Smooth scroll anchors use document.getElementById('id').scrollIntoView({behavior:'smooth'}). No broken links.
J. ANIMATIONS: Use CSS only — @keyframes fadeInUp for hero headline (0.6s ease-out). No JS animation libraries.
K. NO placeholder images: never use picsum.photos, placehold.it, unsplash.com, or any fake image URL in src attributes.
L. RESPONSIVE: Every section must have @media(max-width:768px) rules reducing padding to 20px, reducing hero heading to 2.5rem, and switching grids to a single-column layout.

EXACT STRUCTURE SCAFFOLD — the stitchPrompt MUST describe rendering EXACTLY these elements in this order:

[1] STICKY HEADER
  - Logo text "${businessName}" left
  - Desktop nav links right: ${navPages}
  - Button id=hamburger class=md:hidden (hamburger icon ☰) — toggles mobile menu
  - div id=mobile-menu hidden by default, contains same nav links, close button aria-label=Close menu

[2] SECTION id=hero (full viewport height, asymmetric split-screen layout)
  MANDATORY HERO REQUIREMENTS — do NOT produce a plain centered headline + button:
  - Layout: TWO-COLUMN split (left: 50% text content stack, right: 50% visual element stack)
  - Left column MUST contain ALL of:
    a) A small TRUST BADGE row: e.g. "★★★★★ Trusted by 5,000+ clients" or "✓ Same-Day Bookings" — styled as pill badges with accent colour border
    b) Large headline (exactly 4.5rem, benefit-driven, max 8 words, NO address) — use CSS animation: fade-in-up on load
    c) Subheadline (exactly 1.1rem, value prop, NO address) — slightly muted colour
    d) TWO CTA buttons side by side: PRIMARY button (accent background, "${ctaText || "Get Started"}") + SECONDARY ghost button ("Learn More" or "How It Works")
    e) A horizontal SOCIAL PROOF bar: 3-4 stats with large numbers and labels (e.g. "5,000+ Clients" / "24/7 Available" / "Same-Day Launch") — use accent colour for numbers
  - Right column MUST contain:
    ${heroUrl ? `- Hero image: use exactly this URL as a sticky 600px tall featured image card — ${heroUrl}` : "- Decorative visual: animated CSS gradient orbs/blobs, geometric pattern, or SVG illustration relevant to ${industry} — NO fake image URLs, NO placeholder images"}
    - Overlapping floating stat cards or feature pills (e.g. "Available: Today" or "100% Guaranteed") — positioned with absolute CSS, 8px grid offset, glassmorphic styling
  - Add a CSS keyframe animation for the headline: fade-in from bottom over 0.6s
  - Add a subtle animated background: slow mesh gradient shift, or floating particles (pure CSS)
  - The section must feel like a premium SaaS product landing page — NOT a basic brochure site
  HERO SECTION HEIGHT: min-height: 100vh with display:flex align-items:center

[3] SECTION id=about (asymmetric split layout)
  - Left column: sticky 600px tall image or visual collage using ${heroUrl || "custom SVG gradient graphic"} with rounded corners (border-radius: 16px) and subtle 1px border.
  - Right column: Vertical stack with heading, 2-3 detailed paragraphs about ${businessName}, and 3 compact list cards (each with icon emoji, brief title, description).

[4] SECTION id=services (Bento Grid layout)
  - Heading: "Our Services" (exactly 2.5rem)
  - Bento Grid: Asymmetric 3-column layout. Middle or first service card spans 2 columns to break template repetition.
  - 3-6 service cards total: each with a distinctive icon, title, detailed description, and subtle 1.02x scale transition on hover.
  - Content must be highly specific and fully relevant to ${industry}
${extraSectionsScaffold}
[5] SECTION id=testimonials
  - Heading: "What Our Clients Say"
  - Grid of 3 premium testimonial cards: each with Australian client name, 5-star ★★★★★, and a professional, benefit-oriented quote text

${(() => {
  const faqAsOwnPage = isMultiPage && pages.some((p: string) => /^faq$/i.test(p.trim()));
  const skipFaq = faqAsOwnPage || /portfolio|artist|photographer|creative|gallery/i.test(industry);
  if (skipFaq) return faqAsOwnPage ? `[6] NOTE: FAQ is its own page — do NOT duplicate it as a section on other pages.` : '';
  return `[6] SECTION id=faq
  - Heading: "Frequently Asked Questions"
  - 5-6 accordion Q&A items highly specific to "${industry}" (NOT generic)
  - Each item: <details><summary>Question</summary><p>Answer</p></details>
  - Place this section on the page where it makes most sense: services page for trade businesses, home page for general businesses, booking page for appointment-based businesses`;
})()}

[7] SECTION id=contact (CRITICAL — copy this form structure EXACTLY)
  - Heading: "Get in Touch"
  - Left column: ${clientEmail} and ${clientPhone} and ${businessAddress || "business address"}
  - Right column: RENDER THIS EXACT FORM:
${contactFormScaffold.replace(/ACCENT/g, "the accent colour")}
  - NO extra fields. NO dropdown. NO checkbox. NO Business Name field. ONLY the 4 fields above.
  ${businessAddress ? `- AFTER the form columns: render a Google Maps embed iframe INSIDE this contact section (NOT after the footer) — use src="https://maps.google.com/maps?q=${encodeURIComponent(businessAddress || "")}&output=embed" width="100%" height="300" style="border:0;border-radius:12px;margin-top:40px"` : ""}
  CRITICAL: The contact section and Google Maps embed must appear ABOVE the footer. NEVER place the map after </footer>.

${bookingInstruction ? `[8] ${bookingInstruction}` : ""}
${features.includes("Photo Gallery") ? "[GALLERY] section id=gallery — asymmetrical photo masonry grid" : ""}
${features.includes("Payments / Shop") ? "[SHOP] section id=shop — product cards with class=wg-buy-btn on purchase buttons" : ""}
${features.includes("Newsletter Signup") ? "[NEWSLETTER] section id=newsletter — email input + Subscribe button, id=newsletter-form" : ""}
${isMultiPage ? `
[PRIVACY] REQUIRED — page-section for Privacy Policy (data-page="privacy", id="privacy", class="page-section")
  - Heading: "Privacy Policy"
  - Subheading: "Last updated: ${currentYear}"
  - Sections: Information We Collect | How We Use Your Information | Data Security | Your Rights | Contact Us
  - Each section: h3 heading + 2-3 paragraphs of real policy prose tailored to ${businessName}
  - Style: same background/text colours as rest of site. max-width:800px margin:0 auto padding:80px 24px

[TERMS] REQUIRED — page-section for Terms of Service (data-page="terms", id="terms", class="page-section")
  - Heading: "Terms of Service"
  - Subheading: "Last updated: ${currentYear}"
  - Sections: Acceptance of Terms | Services | Payment & Refunds | Intellectual Property | Limitation of Liability | Governing Law
  - Each section: h3 heading + 2-3 paragraphs of real terms prose tailored to ${businessName} in Australia
  - Style: same background/text colours as rest of site. max-width:800px margin:0 auto padding:80px 24px
` : ""}
${isMultiPage ? `
⚠️ MULTI-PAGE SITE — CRITICAL STRUCTURE RULES ⚠️
This site has ${pages.length} SEPARATE PAGES: ${pageList}

EXACT HTML DOCUMENT ORDER (top to bottom — do NOT deviate):
  1. <head>...</head>
  2. <body style='display:flex;flex-direction:column;min-height:100vh;'>
  3. <header> or <nav>  ← STICKY HEADER — OUTSIDE all data-page divs. ALWAYS VISIBLE on every page.
  4. <div data-page="home" id="home" class="page-section">   ← hero + home sections here
${pages.map((p: string) => `  <div data-page="${p.toLowerCase().replace(/\s+/g,'-')}" id="${p.toLowerCase().replace(/\s+/g,'-')}" class="page-section"> ← ${p} content </div>`).join('\n')}
  <div data-page="privacy" id="privacy" class="page-section"> ← Privacy Policy page </div>
  <div data-page="terms" id="terms" class="page-section"> ← Terms of Service page </div>
  5. <footer>  ← FOOTER — OUTSIDE all data-page divs. ALWAYS VISIBLE on every page.
  6. </body>

⛔ CRITICAL: HEADER AND FOOTER MUST BE OUTSIDE ALL data-page DIVS ⛔
   The header/nav bar must appear BEFORE the first <div data-page=...>.
   The footer must appear AFTER the last <div data-page=...>.
   If the header is placed inside a data-page div it will DISAPPEAR when navigating to other pages.
   Both are shared chrome — always visible regardless of which page is active.

RULES:
- Each data-page value must be the exact lowercase-hyphenated page name
- Nav links MUST use onclick='navigateTo("PAGE_ID")' — NO href="#section" anchors for page navigation
- Do NOT place all content in one scroll page — each page-section div is a full separate view
- Do NOT define navigateTo() or .page-section CSS — these are injected by the pipeline
- The hero section content goes INSIDE data-page="home", NOT outside any div
- The sticky nav bar goes OUTSIDE and BEFORE the first data-page div
` : ""}

[FOOTER] — render as <footer> element OUTSIDE all data-page divs, always visible
  - Copyright © ${currentYear} ${businessName}. All rights reserved.
  - Social links: ${[facebookPage, instagramUrl, linkedinUrl].filter(Boolean).join(", ") || "none"}
  - Legal links row (small text, muted colour): two links side by side —
      Privacy Policy: onclick='navigateTo("privacy")'
      Terms of Service: onclick='navigateTo("terms")'
    Both links use href='#' with onclick to navigate to the policy page-sections.
    Style: font-size:0.8rem; color:#64748b; text-decoration:underline; margin:0 8px;
  - Do NOT include the full privacy/terms text in the footer — just the clickable links.

VISUAL DESIGN (stitchPrompt must describe these with hex codes):
- Primary: pick from colour preferences "${colorPrefs}"
- Accent: contrasting highlight colour
- Background: dark or light base (based on style "${style}")
- Typography: pick specific Google Fonts for headings and body
- The design must look premium, ${industry}-appropriate, and conversion-focused

HERO COPY RULES (strictly enforced):
- heroHeadline: max 8 words, benefit-driven, NO business name, NO address, NO suburb
- heroSubheadline: 1-2 sentences, value prop ONLY, NO address or location

SEO & AEO REQUIREMENTS — mandatory in stitchPrompt:
M. Include JSON-LD LocalBusiness schema in <head>.
N. AEO: FAQ answers must be 40-60 words, complete and self-contained. Use <details><summary> markup. Write entity-rich About paragraph: what the business does, who it serves, where it operates, unique value.

⚠️ JSON OUTPUT RULES — STRICTLY ENFORCED:
1. Return ONLY a single JSON object. No commentary before or after.
2. The stitchPrompt value MUST use ONLY single quotes ' for ALL HTML attributes and CSS values. NEVER use double-quotes inside the stitchPrompt string — they break JSON parsing. Correct: style='color:#fff;' — Wrong: style="color:#fff;"
3. The stitchPrompt MUST be 3500-5000 words. Every section needs full copy: headlines, body text, card content, testimonial quotes with names, FAQ questions AND answers, button labels. Do not summarise — write everything out in full.

Return ONLY this JSON:
{
  "projectTitle": "${businessName} Website",
  "palette": {"primary":"#hex","accent":"#hex","background":"#hex","surface":"#hex","text":"#hex"},
  "typography": {"headingFont":"FontName","bodyFont":"FontName","heroSize":"72px"},
  "sections": ["hero","about","services","testimonials","faq","contact"],
  "tone": "...",
  "heroHeadline": "benefit-driven max 8 words",
  "heroSubheadline": "1-2 sentences value prop only",
  "ctaText": "${ctaText || "Get Started"}",
  "uniqueDesignIdea": "one sentence visual theme",
  "stitchPrompt": "DETAILED rendering instructions following the scaffold above — 3500-5000 words minimum. Describe EVERY section in full detail: all hex colours, exact font sizes, precise spacing values, complete copy for headings/subheadings/body text, card content, button labels, testimonial names and quotes, FAQ questions and answers, contact details. ⚠️ CRITICAL JSON RULE: the stitchPrompt value is a JSON string — NEVER use double-quotes \" inside it. Use ONLY single quotes ' for all HTML attributes and CSS values. Example correct: style='color:#fff' — NEVER style=\"color:#fff\""
}${exampleHtmls.length > 0 ? `

REFERENCE EXAMPLES (structure/depth inspiration — do NOT copy text):
${exampleHtmls.map((e, i) => `--- Example ${i + 1}: ${e.label} ---\n${e.html.slice(0, 4000)}\n---`).join("\n\n")}` : ""}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 10000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  if (!raw) throw new Error("Blueprint: no content returned");
  console.log("[Blueprint] Raw length:", raw.length, "| first 200:", raw.slice(0, 200));

  let blueprint: SiteBlueprint;
  try {
    blueprint = parseJson(raw);
  } catch (e) {
    console.error("[Blueprint] JSON parse failed:", e instanceof Error ? e.message : String(e));
    const title = (raw.match(/"projectTitle"\s*:\s*"([^"]+)"/) || [])[1] || businessName + " Website";
    // Extract stitchPrompt by scanning FORWARD from opening quote.
    // Backward scan breaks when CSS `}` chars inside the string fool lastIndexOf("}").
    const stitchIdx = raw.indexOf('"stitchPrompt"');
    const stitchColonIdx = stitchIdx !== -1 ? raw.indexOf(":", stitchIdx + '"stitchPrompt"'.length) : -1;
    const stitchOpen = stitchColonIdx !== -1 ? raw.indexOf('"', stitchColonIdx + 1) : -1;
    let stitchClose = -1;
    if (stitchOpen !== -1) {
      let si = stitchOpen + 1;
      while (si < raw.length) {
        if (raw[si] === "\\" && si + 1 < raw.length) { si += 2; continue; }
        if (raw[si] === '"') {
          let sj = si + 1;
          while (sj < raw.length && (raw[sj] === " " || raw[sj] === "\t" || raw[sj] === "\r" || raw[sj] === "\n")) sj++;
          if (sj >= raw.length || raw[sj] === "," || raw[sj] === "}") { stitchClose = si; break; }
        }
        si++;
      }
    }
    const stitchPrompt = (stitchOpen !== -1 && stitchClose > stitchOpen)
      ? raw.slice(stitchOpen + 1, stitchClose)
      : raw.slice(0, 8000);
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
  if (blueprint.stitchPrompt.length < 3000) {
    console.warn(`[Blueprint] ⚠️ stitchPrompt is only ${blueprint.stitchPrompt.length} chars — may indicate parse fallback truncation. Expected 3000+ for rich output.`);
  }
  if (!blueprint.projectTitle) throw new Error("Blueprint missing projectTitle");

  // Strip URLs from stitchPrompt — Stitch's renderer throws "expected object at projection path"
  // when the prompt contains http(s):// links. Remove them, keeping surrounding context.
  blueprint.stitchPrompt = blueprint.stitchPrompt
    .replace(/https?:\/\/[^\s"',)>]+/g, "[URL]")
    .replace(/\s{3,}/g, "  ");
  // Do NOT slice stitchPrompt — truncation silently drops multipage and section instructions.

  // For multipage sites, prepend a hard constraint at the very top of the prompt
  // so Stitch sees it before anything else and can't ignore it.
  if (isMultiPage && pages.length > 1) {
    const pageIds = pages.map((p: string) => p.toLowerCase().replace(/\s+/g, "-")).join(", ");
    const multiPageDivs = pages.map((p: string) => {
      const pid = p.toLowerCase().replace(/\s+/g, "-");
      return '  <div data-page="' + pid + '" id="' + pid + '" class="page-section">...</div>';
    }).join("\n");
    const multiPagePrefix = [
      "⚠️ MULTI-PAGE SITE — MANDATORY STRUCTURE ⚠️",
      "This is a " + pages.length + "-page site. You MUST output " + pages.length + " SEPARATE wrappers, each with BOTH data-page= AND id= attributes:",
      multiPageDivs,
      "CRITICAL: Every wrapper needs data-page=\"pageid\" id=\"pageid\" class=\"page-section\" — both data-page AND id required on the same element.",
      "Nav links: onclick=\'navigateTo(\"home\")\' etc. NO anchor scroll links. Do NOT define navigateTo() or .page-section CSS.",
      "",
      "CONTENT DENSITY — minimum requirements per section:",
      "- Home: hero headline + subheadline + 2 CTAs + stats row + 6-card features grid + 3 testimonial cards",
      "- Shop: product grid with images, names, prices, descriptions, Buy Now buttons",
      "- Gallery: 6-9 image cards with captions",
      "- Pricing: 3 tiers with full feature bullet lists and CTAs",
      "- Every section: real business-specific copy — NO placeholder text",
      "Target output: 35KB+ HTML. Each page section must be substantial.",
      "",
    ].join("\n")
    blueprint.stitchPrompt = multiPagePrefix + blueprint.stitchPrompt;
  }

  // Attach SEO metadata to the returned blueprint
  blueprint.lsiKeywords = lsiKeywords;
  blueprint.serpInsights = serpInsights ?? undefined;

  console.log(`[Blueprint] Done: "${blueprint.projectTitle}" — stitch ${blueprint.stitchPrompt.length} chars | LSI: ${lsiKeywords.length} keywords | SERP: ${serpInsights ? "yes" : "no"}`);
  return blueprint;
}

// ── Google Indexing API ───────────────────────────────────────────────────────
// Pings Google to index a URL immediately after deploy.
// Requires GOOGLE_INDEXING_SA_KEY env var = base64-encoded service account JSON
// with the Indexing API enabled and the site verified in Search Console.
// Non-fatal — a failure here never blocks the deploy.

export async function requestGoogleIndexing(url: string): Promise<void> {
  if (url && url.includes(".vercel.app")) {
    console.log(`[Indexing] Skipping indexing request for Vercel deployment alias: ${url}`);
    return;
  }
  const saKeyB64 = process.env.GOOGLE_INDEXING_SA_KEY;
  if (!saKeyB64) {
    console.log("[Indexing] GOOGLE_INDEXING_SA_KEY not set — skipping");
    return;
  }

  try {
    const saKey = JSON.parse(Buffer.from(saKeyB64, "base64").toString("utf-8")) as {
      client_email: string;
      private_key: string;
    };

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: saKey.client_email,
      sub: saKey.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/indexing",
    })).toString("base64url");

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(saKey.private_key, "base64url");
    const jwt = `${header}.${payload}.${sig}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!tokenRes.ok) {
      console.warn(`[Indexing] Token exchange failed: ${tokenRes.status}`);
      return;
    }
    const { access_token } = await tokenRes.json() as { access_token: string };

    const indexRes = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });

    if (indexRes.ok) {
      console.log(`[Indexing] ✅ Submitted ${url} to Google Indexing API`);
    } else {
      const errText = await indexRes.text();
      console.warn(`[Indexing] API returned ${indexRes.status}: ${errText.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn("[Indexing] Failed (non-fatal):", e instanceof Error ? e.message : String(e));
  }
}
