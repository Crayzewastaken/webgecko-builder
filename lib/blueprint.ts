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
  logoUrl?: string;
  heroUrl?: string;
}): Promise<SiteBlueprint> {
  const {
    businessName, industry, targetAudience, usp, goal, style, colorPrefs,
    references, features, clientEmail, clientPhone, businessAddress,
    facebookPage, additionalNotes, pages, isMultiPage, hasBooking, bookingUrl,
    pricingSection, imageSection, productsWithPhotos,
    instagramUrl, linkedinUrl, tiktokUrl, realTestimonials, blogTopics, videoUrl, shopProducts,
    exampleHtmls = [],
    logoUrl = "",
    heroUrl: heroImageUrl = "",
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
    : pages.map(p => `<a href='#${p.toLowerCase().replace(/\s+/g,"-")}'>${p}</a>`).join(" ");

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

  // Build section list from what the user actually requested
  const clientLocation = businessAddress ? businessAddress.split(",").pop()?.trim() || "local area" : "local area";
  const clientRealTestimonials = (context as any).realTestimonials || "";
  const clientShopProducts = (context as any).shopProducts || "";
  const clientReferences = (context as any).references || "";
  const clientTargetAudience = (context as any).targetAudience || "general public";

  const requiredSectionIds = [...new Set([
    "home", "about", "services",
    ...(isMultiPage ? pages.map((p: string) => p.toLowerCase().replace(/\s+/g, "-")) : []),
    ...(hasBooking ? ["booking"] : []),
    ...(features.includes("Photo Gallery") ? ["gallery"] : []),
    ...(features.includes("Payments / Shop") ? ["shop"] : []),
    ...(features.includes("Newsletter Signup") ? ["newsletter"] : []),
    "contact",
  ])];

  // Build image context — tell Stitch exactly what images the client uploaded
  const imageContext = [
    logoUrl ? `Logo image provided — use it in the nav header: ${logoUrl}` : "No logo uploaded — use business name as text logo",
    heroUrl ? `Hero/feature image provided — use as hero background or hero visual: ${heroUrl}` : "No hero image — use a relevant design visual or gradient",
    photoUrls && photoUrls.length > 0 ? `${photoUrls.length} gallery/work photos provided — use them in gallery section and about section: ${photoUrls.slice(0, 5).join(", ")}${photoUrls.length > 5 ? ` ...and ${photoUrls.length - 5} more` : ""}` : "No gallery photos uploaded",
  ].join("\n");

  // Build section descriptions outside the template literal to avoid nested backtick issues
  const sectionDescriptions = requiredSectionIds.filter((id: string) => id !== "home").map((id: string) => {
    if (id === "about") return `   - About (id=about): Tell ${businessName}'s story. Highlight: ${usp || "quality and reliability"}. Mention serving ${clientLocation}.`;
    if (id === "services") return `   - Services (id=services): List all services ${businessName} offers in ${industry}. Real service names and descriptions specific to this industry.`;
    if (id === "booking") return `   - Booking (id=booking): Section heading 'Book an Appointment'. Short intro paragraph about booking with ${businessName}. Leave a clearly labelled placeholder container for the booking iframe — do NOT generate a fake booking form, just a container div.`;
    if (id === "gallery") return `   - Gallery (id=gallery): Masonry photo grid. ${photoUrls && photoUrls.length > 0 ? "Use the " + photoUrls.length + " provided client photos." : "Use image placeholder slots."}`;
    if (id === "shop") return `   - Shop (id=shop): Product cards with images, names, prices. Buy Now buttons MUST have class='wg-buy-btn'.${clientShopProducts ? " Products: " + clientShopProducts : ""}`;
    if (id === "pricing") return `   - Pricing (id=pricing): ${pricingSection}`;
    if (id === "reviews" || id === "testimonials") return `   - Reviews (id=${id}): ${clientRealTestimonials ? "Use these real testimonials: " + clientRealTestimonials : "3 testimonial cards with star ratings, customer name and location, specific quote about " + businessName}`;
    if (id === "faq") return `   - FAQ (id=faq): 5-6 accordion questions specific to ${industry} — questions real customers ask`;
    if (id === "newsletter") return `   - Newsletter (id=newsletter-form): Email capture with subscribe button`;
    if (id === "contact") return `   - Contact (id=contact): Form with name/email/phone/message. Display phone: ${clientPhone}, email: ${clientEmail}${businessAddress ? ", address: " + businessAddress : ""}${businessAddress ? ". Include a Google Maps embed." : ""}`;
    if (id === "blog") return `   - Blog (id=blog): Grid of blog post preview cards`;
    if (id === "team") return `   - Team (id=team): Team member cards with photo, name, role`;
    return `   - ${id} (id=${id}): Section with relevant content for ${businessName}`;
  }).join("\n");

  const heroImageLine = heroUrl ? `Use the provided hero image as the main visual: ${heroUrl}` : "Design a compelling hero visual appropriate for " + industry;
  const logoLine = logoUrl ? `Display the client logo in the sticky nav: ${logoUrl}` : "Use business name as text logo in nav";

  const prompt = `You are a world-class web designer creating a unique, high-quality website for a real business. Your job is to produce a detailed Stitch AI prompt that will generate a stunning, conversion-focused website specific to THIS business.

═══════════════════════════════════════
CLIENT BRIEF
═══════════════════════════════════════
Business Name: ${businessName}
Industry: ${industry}
USP / What makes them different: ${usp || "quality service"}
Target audience: ${clientTargetAudience}
Primary goal: ${goal || "get more customers"}
Style preference: ${style || "modern premium"}
Colour preferences: ${colorPrefs || "choose something appropriate for the industry"}
Additional notes from client: ${additionalNotes || "none"}
${clientRealTestimonials ? "Real client testimonials to include:\n" + clientRealTestimonials : ""}
${clientReferences ? "Design references/inspiration: " + clientReferences : ""}

Contact details (use in contact section only):
- Phone: ${clientPhone}
- Email: ${clientEmail}
- Address: ${businessAddress || "not provided"}
- Facebook: ${facebookPage || "none"}
- Instagram: ${instagramUrl || "none"}
- LinkedIn: ${linkedinUrl || "none"}

Images the client uploaded:
${imageContext}

${pricingSection !== "No pricing section needed." ? `Pricing: ${pricingSection}` : ""}
${(context as any).shopProducts ? `Shop products: ${(context as any).shopProducts}` : ""}
${(context as any).bookingServices ? `Booking services offered: ${(context as any).bookingServices}` : ""}
${serpGuidance}${lsiInstruction}
═══════════════════════════════════════
PAGES / SECTIONS REQUIRED
═══════════════════════════════════════
Site type: ${isMultiPage ? "MULTI-PAGE — each section is a separate navigable page" : "SINGLE-PAGE — one long scrollable site"}
Required section IDs: ${requiredSectionIds.join(", ")}
${isMultiPage ? `Multi-page structure: each page uses <div data-page="PAGEID" id="PAGEID" class="page-section">. Nav/footer OUTSIDE these wrappers. Nav links use onclick='navigateTo("pageid")'.` : `Single-page: anchor href="#sectionid" links.`}

═══════════════════════════════════════
YOUR TASK
═══════════════════════════════════════
Write the stitchPrompt field — a 600-1000 word brief sent directly to Stitch AI to generate the HTML.

The stitchPrompt MUST:

1. START with a specific visual identity statement — describe the exact mood, colour direction, and aesthetic. Be vivid and specific, not generic. Examples:
   - "Deep charcoal and burnt orange — the feel of a premium tradie workshop, raw and confident"
   - "Crisp white with sage green accents — calm, trustworthy, like a boutique health clinic"
   - "Rich navy and warm gold — sophisticated and established, like a premium law firm"
   Derive this from the client's style preference ("${style || "modern"}") and colour preferences ("${colorPrefs || "professional"}"). NEVER default to generic blue unless explicitly requested.

2. Describe the HERO section (id=home):
   - Write the actual headline (max 8 words, benefit-driven, specific to ${businessName})
   - Write the subheadline (1-2 sentences, value prop)
   - CTA button text: "${ctaText}"
   - ${heroImageLine}
   - ${logoLine}

3. Describe EVERY required section with real content:
${sectionDescriptions}

4. Typography direction: describe the font personality (bold/condensed/elegant/playful etc) — do NOT name specific fonts

5. Layout direction: specify the hero layout style (split-screen / full-bleed / asymmetric / centred), card style for services (bento grid / icon cards / horizontal list), overall page feel

6. Include JSON-LD LocalBusiness schema in <head> with: name="${businessName}", phone="${clientPhone}", email="${clientEmail}"${businessAddress ? ", address=" + businessAddress : ""}

⚠️ JSON OUTPUT RULES:
1. Return ONLY a single JSON object. No text before or after.
2. The stitchPrompt value MUST use ONLY single quotes ' — NEVER double-quotes inside it. Double-quotes break JSON parsing.
3. The stitchPrompt must be 600-1000 words. Short = generic output.

Return ONLY:
{
  "projectTitle": "${businessName} Website",
  "palette": {"primary":"#hex","accent":"#hex","background":"#hex","surface":"#hex","text":"#hex"},
  "typography": {"headingFont":"FontName","bodyFont":"FontName","heroSize":"72px"},
  "sections": ${JSON.stringify(requiredSectionIds)},
  "tone": "...",
  "heroHeadline": "max 8 words, benefit-driven, specific to ${businessName}",
  "heroSubheadline": "1-2 sentences value prop",
  "ctaText": "${ctaText}",
  "uniqueDesignIdea": "one specific sentence: colour mood + layout style + feel",
  "stitchPrompt": "YOUR 600-1000 WORD BRIEF — unique visual direction + full content for every section. Single quotes ONLY."
}${exampleHtmls.length > 0 ? `

REFERENCE EXAMPLES (layout inspiration only — do NOT copy colours/content):
${exampleHtmls.map((e, i) => `--- Example ${i + 1}: ${e.label} ---\n${e.html.slice(0, 3000)}\n---`).join("\n\n")}` : ""}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
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
  if (blueprint.stitchPrompt.length < 1500) {
    console.warn(`[Blueprint] ⚠️ stitchPrompt is only ${blueprint.stitchPrompt.length} chars — too short, sites will look generic. Expected 3000+ chars.`);
  }
  if (blueprint.stitchPrompt.length > 12000) {
    console.warn(`[Blueprint] ⚠️ stitchPrompt is ${blueprint.stitchPrompt.length} chars — truncating to 12000`);
    blueprint.stitchPrompt = blueprint.stitchPrompt.slice(0, 12000);
  }
  if (!blueprint.projectTitle) throw new Error("Blueprint missing projectTitle");

  // Strip URLs from stitchPrompt — Stitch's renderer throws "expected object at projection path"
  // when the prompt contains http(s):// links. Remove them, keeping surrounding context.
  blueprint.stitchPrompt = blueprint.stitchPrompt
    .replace(/https?:\/\/[^\s"',)>]+/g, "[URL]")
    .replace(/\s{3,}/g, "  ");
  // Do NOT slice stitchPrompt — truncation silently drops multipage and section instructions.

  // For multipage sites, prepend the structural wrapper requirement only.
  // Do NOT prescribe content, theme, or layout — that's Stitch's job.
  if (isMultiPage && pages.length > 1) {
    const multiPageDivs = pages.map((p: string) => {
      const pid = p.toLowerCase().replace(/\s+/g, "-");
      return `  <div data-page="${pid}" id="${pid}" class="page-section">...</div>`;
    }).join("\n");
    const multiPagePrefix = `MULTI-PAGE STRUCTURE REQUIRED:\nOutput ${pages.length} separate page wrappers with data-page= AND id= on the same element:\n${multiPageDivs}\nNav links use onclick='navigateTo("pageid")' — NOT href anchors. Do NOT define navigateTo() or .page-section CSS.\n\n`;
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
