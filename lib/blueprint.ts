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
      model: "claude-haiku-4-5-20251001",
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

// ── JSON parser (unchanged from original) ────────────────────────────────────

function parseJson(raw: string): SiteBlueprint {
  let s = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/m, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);

  try { return JSON.parse(s) as SiteBlueprint; } catch {}

  try {
    const spKey = '"stitchPrompt"';
    const spIdx = s.indexOf(spKey);
    if (spIdx !== -1) {
      const colonIdx = s.indexOf(":", spIdx + spKey.length);
      const quoteOpen = s.indexOf('"', colonIdx + 1);
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
          .replace(/\\n/g, "\n").replace(/\\t/g, "\t")
          .replace(/\\'/g, "'").replace(/\\"/g, '"');
        return obj;
      }
    }
  } catch {}

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
${serpGuidance}${lsiInstruction}
RULES:
1. JSON only — no markdown, no backticks. Start with { end with }
2. Inside string values use only single quotes
3. No markdown (** or *) anywhere
4. stitchPrompt MUST follow the EXACT STRUCTURE SCAFFOLD below — this is non-negotiable

EXACT STRUCTURE SCAFFOLD — the stitchPrompt MUST describe rendering EXACTLY these elements in this order:

[1] STICKY HEADER
  - Logo text "${businessName}" left
  - Desktop nav links right: ${navPages}
  - Button id=hamburger class=md:hidden (hamburger icon ☰) — toggles mobile menu
  - div id=mobile-menu hidden by default, contains same nav links, close button aria-label=Close menu

[2] SECTION id=hero (full viewport height, visually striking)
  - Large headline (benefit-driven, max 8 words, NO address)
  - Subheadline 1-2 sentences (value prop only, NO address)
  - ONE primary CTA button: text="${ctaText || "Get Started"}", href='#', onclick scrolls to #${hasBooking ? "booking" : "contact"}
  - Stats bar below: 3-4 numbers relevant to ${industry} (e.g. years in business, clients served)
  ${heroUrl ? `- Hero image: use exactly this URL — ${heroUrl}` : "- Hero: gradient or dark background, no fake image URLs"}

[3] SECTION id=about
  - 2-3 paragraphs about ${businessName}
  - Why choose us — 3 icon+text feature blocks

[4] SECTION id=services
  - Heading: "Our Services"
  - Grid of 3-6 service cards with icon, title, description
  - Each relevant to ${industry}

[5] SECTION id=testimonials
  - Heading: "What Our Clients Say"
  - 3 testimonial cards with Australian names, 5-star ★★★★★, quote text

[6] SECTION id=faq
  - Heading: "Frequently Asked Questions"
  - 6 accordion Q&A items relevant to ${industry}
  - Each item: summary (question) + details (answer)

[7] SECTION id=contact (CRITICAL — copy this form structure EXACTLY)
  - Heading: "Get in Touch"
  - Left column: ${clientEmail} and ${clientPhone} and ${businessAddress || "business address"}
  - Right column: RENDER THIS EXACT FORM:
${contactFormScaffold.replace(/ACCENT/g, "the accent colour")}
  - NO extra fields. NO dropdown. NO checkbox. NO Business Name field. ONLY the 4 fields above.

${bookingInstruction ? `[8] ${bookingInstruction}` : ""}
${features.includes("Photo Gallery") ? "[GALLERY] section id=gallery — image grid" : ""}
${features.includes("Payments / Shop") ? "[SHOP] section id=shop — product cards with class=wg-buy-btn on purchase buttons" : ""}
${features.includes("Newsletter Signup") ? "[NEWSLETTER] section id=newsletter — email input + Subscribe button, id=newsletter-form" : ""}
${isMultiPage ? `[MULTI-PAGE] Each page: <div data-page="PAGE_ID" id="PAGE_ID" class="page-section">. Pages: ${pageList}. Nav uses onclick=navigateTo('id'). Do NOT define navigateTo() or .page-section CSS.` : ""}

[FOOTER]
  - Copyright © ${currentYear} ${businessName}
  - Social links: ${[facebookPage, instagramUrl, linkedinUrl].filter(Boolean).join(", ") || "none"}

VISUAL DESIGN (stitchPrompt must describe these with hex codes):
- Primary: pick from colour preferences "${colorPrefs}"
- Accent: contrasting highlight colour
- Background: dark or light base (based on style "${style}")
- Typography: pick specific Google Fonts for headings and body
- The design must look premium, ${industry}-appropriate, and conversion-focused

HERO COPY RULES (strictly enforced):
- heroHeadline: max 8 words, benefit-driven, NO business name, NO address, NO suburb
- heroSubheadline: 1-2 sentences, value prop ONLY, NO address or location

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
  "stitchPrompt": "DETAILED rendering instructions following the scaffold above — 1000-2000 words, describe every section, all hex colours, fonts, spacing, content. Single quotes inside only."
}${exampleHtmls.length > 0 ? `

REFERENCE EXAMPLES (structure/depth inspiration — do NOT copy text):
${exampleHtmls.map((e, i) => `--- Example ${i + 1}: ${e.label} ---\n${e.html.slice(0, 4000)}\n---`).join("\n\n")}` : ""}`;

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
  } catch (e) {
    console.error("[Blueprint] JSON parse failed:", e instanceof Error ? e.message : String(e));
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

  // Strip URLs from stitchPrompt — Stitch's renderer throws "expected object at projection path"
  // when the prompt contains http(s):// links. Remove them, keeping surrounding context.
  blueprint.stitchPrompt = blueprint.stitchPrompt
    .replace(/https?:\/\/[^\s"',)>]+/g, "[URL]")
    .replace(/\s{3,}/g, "  ")
    .slice(0, 12000);

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
  const saKeyB64 = process.env.GOOGLE_INDEXING_SA_KEY;
  if (!saKeyB64) {
    console.log("[Indexing] GOOGLE_INDEXING_SA_KEY not set — skipping");
    return;
  }

  try {
    // Decode service account key
    const saKey = JSON.parse(Buffer.from(saKeyB64, "base64").toString("utf-8")) as {
      client_email: string;
      private_key: string;
    };

    // Build a signed JWT for the Indexing API scope
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

    // Sign with RS256 using Node crypto
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(saKey.private_key, "base64url");
    const jwt = `${header}.${payload}.${sig}`;

    // Exchange JWT for access token
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

    // Submit URL to Indexing API
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
