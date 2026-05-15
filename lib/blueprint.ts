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
  designMd?: string;
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
  // Strip all code fences (multiline-safe)
  let s = raw.replace(/```json[\s\S]*?```/g, m => m.replace(/```json\s*/g, "").replace(/```/g, ""))
             .replace(/```[\s\S]*?```/g, m => m.replace(/```\s*/g, ""))
             .replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/gm, "").trim();
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

  const contactFormScaffold = `<form id='contact-form' onsubmit='(function(f,e){e.preventDefault();var btn=f.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Sending...";var d={jobId:"JOB_ID_PLACEHOLDER",name:f.name.value,email:f.email.value,phone:f.phone?f.phone.value:"",message:f.message.value};fetch("https://webgeckofl.vercel.app/api/contact/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(function(r){return r.json()}).then(function(r){if(r.ok){f.style.display="none";document.getElementById("contact-success").style.display="block";}else{btn.disabled=false;btn.textContent="Send Message";}}).catch(function(){btn.disabled=false;btn.textContent="Send Message";});})(this,event)'>
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
${serpGuidance}${lsiInstruction}
RULES:
1. JSON only — no markdown, no backticks. Start with { end with }
2. Inside string values use only single quotes
3. No markdown (** or *) anywhere
4. stitchPrompt MUST follow the EXACT STRUCTURE SCAFFOLD below — this is non-negotiable

EXACT STRUCTURE SCAFFOLD — the stitchPrompt MUST describe rendering EXACTLY these elements in this order:

⚠️ COLOUR CONSISTENCY RULE (NON-NEGOTIABLE): Every section background MUST be a shade of the same base colour family (e.g. all cool-navy variants: #0a0f1a, #0d1420, #111827). NEVER switch from a cool palette to a warm palette between sections. The hero background and the body background must belong to the same colour family.

[1] STICKY HEADER
  - Logo text "${businessName}" left
  - Desktop nav links right: ${navPages}
  - Button id=hamburger class=md:hidden (hamburger icon ☰) — toggles mobile menu
  - div id=mobile-menu hidden by default, contains same nav links, close button aria-label=Close menu

[2] SECTION id=hero (full viewport height, visually striking — THIS IS THE MOST IMPORTANT SECTION)
  MANDATORY HERO REQUIREMENTS — do NOT produce a plain centered headline + button:
  - Layout: TWO-COLUMN split (left: text content, right: visual element) OR full-bleed cinematic layout with layered depth
  - Left/main column MUST contain ALL of:
    a) A small TRUST BADGE row above the headline: e.g. "★★★★★ Trusted by 5,000+ patients" or "✓ AHPRA Registered ✓ Medicare Bulk Billing ✓ Same-Day Appointments" — styled as pill badges with accent colour border
    b) Large headline (benefit-driven, max 8 words, NO address) — use CSS animation: fade-in-up on load
    c) Subheadline 1-2 sentences (value prop, NO address) — slightly muted colour
    d) TWO CTA buttons side by side: PRIMARY button (accent background, "${ctaText || "Get Started"}") + SECONDARY ghost button ("Learn More" or "How It Works")
    e) A horizontal SOCIAL PROOF bar: 3-4 micro-stats with large numbers and labels (e.g. "5,000+ Patients" / "24/7 Available" / "< 10min Wait" / "50+ Doctors") — use accent colour for numbers
  - Right column (or background layer) MUST contain:
    ${heroUrl ? `- Hero image: use exactly this URL as a full-bleed background or right-column image — ${heroUrl}` : "- Decorative visual: animated CSS gradient orbs/blobs, geometric pattern, or SVG illustration relevant to ${industry} — NO fake image URLs, NO placeholder images"}
    - Floating stat cards or feature pills overlapping the visual (e.g. a card showing "Next available: Today 2:00pm" or a badge "100% Secure & Private") — positioned with absolute CSS
  - Add a CSS keyframe animation for the headline: fade-in from bottom over 0.6s
  - Add a subtle animated background: either a slow gradient shift, floating particles (pure CSS), or a mesh gradient
  - The section must feel like a premium SaaS or medical tech landing page — NOT a basic brochure site
  HERO SECTION HEIGHT: min-height: 100vh with display:flex align-items:center

[3] SECTION id=about
  - 2-3 paragraphs about ${businessName}
  - Why choose us — 3 icon+text feature blocks

[4] SECTION id=services
  - Heading: "Our Services"
  - Grid of 3-6 service cards with icon, title, description
  - Each relevant to ${industry}
${extraSectionsScaffold}
[5] SECTION id=testimonials
  - Heading: "What Our Clients Say"
  - 3 testimonial cards with Australian names, 5-star ★★★★★, quote text

${(() => {
  // FAQ placement: only include as a dedicated section if it genuinely adds value
  // Skip for sites where FAQ is its own page, or very simple portfolio/creative sites
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
${features.includes("Photo Gallery") ? "[GALLERY] section id=gallery — image grid" : ""}
${features.includes("Payments / Shop") ? "[SHOP] section id=shop — product cards with class=wg-buy-btn on purchase buttons" : ""}
${features.includes("Newsletter Signup") ? "[NEWSLETTER] section id=newsletter — email input + Subscribe button, id=newsletter-form" : ""}
${isMultiPage ? `
⚠️ MULTI-PAGE SITE — THIS IS MANDATORY, NOT OPTIONAL ⚠️
This site has ${pages.length} SEPARATE PAGES: ${pageList}
REQUIRED STRUCTURE — every page must be its own top-level div:
  <div data-page="home" id="home" class="page-section">   ← HOME page content </div>
  <div data-page="services" id="services" class="page-section">   ← SERVICES page content </div>
  ... one <div data-page="PAGE_ID"> per page listed above ...
RULES:
- Each data-page value must be the lowercase-hyphenated page name (e.g. "about-us", "contact")
- Nav links MUST use onclick='navigateTo("PAGE_ID")' — NO href="#section" anchors
- Do NOT place all content in one scroll page — each page-section div is a full separate view
- Do NOT define navigateTo() or .page-section CSS — these are injected by the pipeline
- All sections (hero, services, testimonials, contact) go INSIDE the appropriate page div
- The home page div must contain the hero section
` : ""}

[FOOTER]
  - Copyright © ${currentYear} ${businessName}
  - Social links: ${[facebookPage, instagramUrl, linkedinUrl].filter(Boolean).join(", ") || "none"}

CONTENT DEPTH REQUIREMENTS (non-negotiable — every section must be substantive):
- Hero: headline (max 8 words) + subheadline (2 sentences) + trust badges + dual CTA + 3-4 stats. DO NOT make this a blank or placeholder section.
- About: 3 full paragraphs minimum. Include a "Why Choose Us" block with 3 icon+text items. Each paragraph: 3-5 sentences of genuine, industry-specific copy.
- Services: minimum 4 service cards. Each card: bold title + 3-sentence description + ONE specific benefit stat (e.g. "98% client satisfaction"). NOT one-liners.
- Testimonials: 3 testimonials, each with a FULL QUOTE of 2-3 sentences. Australian names + suburb. 5-star rating. NOT "Great service!" one-liners.
- FAQ: 5 questions, each answer 2-4 sentences. Questions must be specific to "${industry}" — what real customers actually ask. Not generic.
- Contact: full address + phone (clickable tel: link) + email. Real contact info layout, not a placeholder.
- Each section heading must be a specific, benefit-driven H2 (not just "Services" or "About Us" — e.g. "Expert ${industry} Services in ${location || "Australia"}" or "Why ${businessName} Outperforms the Rest").
- Total visible word count across all sections: minimum 800 words.
- The site must NOT feel like a template — every sentence must be tailored to this exact business.

HEADER REQUIREMENTS:
- Logo/business name on the left
- Nav links in the centre or right
- On the far right: a click-to-call phone button styled as a pill: <a href='tel:${clientPhone}' style='...'>${clientPhone}</a>
- Mobile: hamburger button (id=hamburger) replaces nav + phone link

VISUAL DESIGN — STRICT COLOUR RULES (stitchPrompt MUST use these exact hex codes everywhere):
- Decide on ONE coherent dark colour palette and use it consistently across ALL sections
- Background (body, all sections): ONE dark base colour — either cool-dark navy (#0a0f1a) or warm-dark charcoal (#0f0f0f) — NEVER a brownish/warm colour unless explicitly requested in colour prefs
- ALL section backgrounds must be VARIATIONS of the same base (e.g. #0a0f1a, #0d1320, #111827) — NOT a completely different hue
- The hero gradient MUST use the same colour family as the body background — no colour-family switching
- Accent/CTA colour: pick from "${colorPrefs}" — a vivid contrasting colour (e.g. #00c896 teal, #3b82f6 blue, #f97316 orange, #8b5cf6 purple) based on the industry
- Text: #e2e8f0 (main), #94a3b8 (muted) — always high-contrast on the dark background
- NEVER use Tailwind Material You brownish dark tokens (surface-container, #1d100c, etc.) — use explicit hex codes
- Typography: pick specific Google Fonts for headings and body
- The design must look like a premium SaaS / tech landing page, ${industry}-appropriate, and conversion-focused

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
  "stitchPrompt": "DETAILED rendering instructions following the scaffold above — 1500-2500 words minimum. Describe every section in full: exact hex colours, font names, spacing values, ALL copy text written out in full (not placeholders), icon names, animation names. Every section must have its full text content written out — not 'Lorem ipsum' or '[insert text]'. Single quotes inside only. No markdown."
}${exampleHtmls.length > 0 ? `

REFERENCE EXAMPLES (structure/depth inspiration — do NOT copy text):
${exampleHtmls.map((e, i) => `--- Example ${i + 1}: ${e.label} ---\n${e.html.slice(0, 4000)}\n---`).join("\n\n")}` : ""}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
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
    .replace(/\s{3,}/g, "  ");
  // Do NOT slice stitchPrompt — truncation silently drops multipage and section instructions.

  // Prepend the palette as hard hex codes so Stitch cannot deviate to Material You browns
  const p = blueprint.palette || {};
  const palettePrefix = `⚠️ MANDATORY COLOUR PALETTE — USE THESE EXACT HEX CODES, NO SUBSTITUTIONS:\n` +
    `- Body background: ${p.background || "#0a0f1a"}\n` +
    `- Section surfaces: shades of ${p.background || "#0a0f1a"} (e.g. ${p.surface || "#0f1623"}, #111827)\n` +
    `- Hero gradient: starts from ${p.background || "#0a0f1a"} family — same colour family as body\n` +
    `- Accent / CTA buttons: ${p.accent || "#00c896"}\n` +
    `- Main text: ${p.text || "#e2e8f0"}\n` +
    `- Muted text: #94a3b8\n` +
    `- DO NOT use Tailwind Material You dark tokens or brownish warm colours (#1d100c, #2a1c18, etc.)\n\n`;
  blueprint.stitchPrompt = palettePrefix + blueprint.stitchPrompt;

  // For multipage sites, prepend a hard constraint at the very top of the prompt
  // so Stitch sees it before anything else and can't ignore it.
  if (isMultiPage && pages.length > 1) {
    const pageIds = pages.map((p: string) => p.toLowerCase().replace(/\s+/g, "-")).join(", ");
    const multiPageDivs = pages.map((p: string) => {
      const pid = p.toLowerCase().replace(/\s+/g, "-");
      return '  <div data-page="' + pid + '" id="' + pid + '" class="page-section">...</div>';
    }).join("\n");
    const multiPagePrefix = "⚠️ MULTI-PAGE SITE — MANDATORY STRUCTURE ⚠️\nThis is a " + pages.length + "-page site. You MUST output " + pages.length + " separate top-level divs:\n" + multiPageDivs + "\nNav links use onclick='navigateTo(\"" + pageIds.split(", ")[0] + "\")' etc. NO anchor scroll links. Do NOT define navigateTo() or .page-section CSS.\n\n";
    blueprint.stitchPrompt = multiPagePrefix + blueprint.stitchPrompt;
  }

  // Attach SEO metadata to the returned blueprint
  blueprint.lsiKeywords = lsiKeywords;
  blueprint.serpInsights = serpInsights ?? undefined;

  // ── Generate DESIGN.md design system spec ──────────────────────────────────
  // Produces machine-readable tokens Stitch can use natively, separate from
  // the stitchPrompt content instructions.
  const p2 = blueprint.palette || {};
  blueprint.designMd = `---
version: alpha
name: ${blueprint.projectTitle}
colors:
  background: "${p2.background || "#0a0f1a"}"
  surface: "${p2.surface || "#0f1623"}"
  primary: "${p2.primary || "#4a9eff"}"
  accent: "${p2.accent || "#00c896"}"
  text: "${p2.text || "#e2e8f0"}"
  muted: "#94a3b8"
typography:
  h1:
    fontFamily: ${blueprint.typography?.headingFont || "Inter"}
    fontSize: ${blueprint.typography?.heroSize || "64px"}
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.03em
  h2:
    fontFamily: ${blueprint.typography?.headingFont || "Inter"}
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  body-md:
    fontFamily: ${blueprint.typography?.bodyFont || "Inter"}
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: ${blueprint.typography?.bodyFont || "Inter"}
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.08em
rounded:
  sm: 6px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 14px 28px
  button-primary-hover:
    backgroundColor: "${p2.primary || "#4a9eff"}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: 12px 24px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  nav:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
---

## Overview

${blueprint.tone || "Premium, modern, conversion-focused"} design for ${blueprint.projectTitle}. The UI is dark, sophisticated, and built for trust and conversions.

## Colors

Dark premium palette — all sections use variations of the same base colour family.

- **Background (${p2.background || "#0a0f1a"}):** Deep navy base for body and hero backgrounds.
- **Surface (${p2.surface || "#0f1623"}):** Slightly lighter for cards and panels.
- **Primary (${p2.primary || "#4a9eff"}):** Brand blue for accents and highlights.
- **Accent (${p2.accent || "#00c896"}):** High-contrast CTA colour for all buttons and key actions.
- **Text (${p2.text || "#e2e8f0"}):** Near-white for maximum readability on dark backgrounds.
- **Muted (#94a3b8):** Secondary text, captions, and metadata.

## Typography

${blueprint.typography?.headingFont || "Inter"} for headings, ${blueprint.typography?.bodyFont || "Inter"} for body. Headlines are bold and tight. Body text is readable and airy.

## Layout

Max-width 1200px centred layout. 8px base spacing grid. Generous section padding (80px vertical). Card-based content blocks with 24px internal padding.

## Elevation & Depth

Depth through tonal layering — background → surface → raised. Subtle box shadows on cards (0 4px 24px rgba(0,0,0,0.5)). Glowing accent borders on hover.

## Shapes

Consistent rounded corners: cards at 16px, buttons at 12px, pills at 9999px.

## Components

Primary CTA buttons use accent colour with white text. Secondary buttons are ghost style with accent border. Cards have surface background with subtle border.

## Do's and Don'ts

- Do use accent colour only for primary CTAs and key statistics
- Do keep all section backgrounds within the same dark colour family
- Don't use warm/brownish dark tones — stay in cool navy family
- Don't use placeholder text — every section must have real business content
- Do maintain WCAG AA contrast (4.5:1 minimum) for all text
`;

  console.log(`[Blueprint] Done: "${blueprint.projectTitle}" — stitch ${blueprint.stitchPrompt.length} chars | designMd ${blueprint.designMd.length} chars | LSI: ${lsiKeywords.length} keywords | SERP: ${serpInsights ? "yes" : "no"}`);
  return blueprint;
}

// ── Google Indexing API ───────────────────────────────────────────────────────
// Pings Google to index a URL immediately after deploy.
// Requires GOOGLE_INDEXING_SA_KEY env var = base64-encoded service account JSON
// with the Indexing API enabled and the site verified in Search Console.
// Non-fatal -- a failure here never blocks the deploy.

async function getGoogleAccessToken(saKeyB64: string): Promise<string> {
  const saRaw = Buffer.from(saKeyB64, "base64").toString("utf-8");
  // Parse private_key separately to handle literal newlines in the PEM block
  const keyMatch = saRaw.match(/"private_key"\s*:\s*"([\s\S]+?)"\s*,/);
  const saObj = JSON.parse(
    keyMatch
      ? saRaw.replace(keyMatch[0], '"private_key":"__PK__",')
      : saRaw
  );
  if (keyMatch) {
    saObj.private_key = keyMatch[1].replace(/\\n/g, "\n");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: saObj.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(saObj.private_key, "base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Google OAuth failed: ${data.error}`);
  return data.access_token;
}

export async function requestGoogleIndexing(url: string): Promise<void> {
  const saKeyB64 = process.env.GOOGLE_INDEXING_SA_KEY;
  if (!saKeyB64) {
    console.log("[Indexing] GOOGLE_INDEXING_SA_KEY not set -- skipping");
    return;
  }
  if (url.includes("vercel.app")) {
    console.log("[Indexing] Skipping vercel.app URL -- only indexing custom domains");
    return;
  }
  try {
    const token = await getGoogleAccessToken(saKeyB64);
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log(`[Indexing] Submitted ${url} to Google:`, data);

    const sitemapUrl = `${url.replace(/\/$/, "")}/sitemap.xml`;
    await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: sitemapUrl, type: "URL_UPDATED" }),
    });
    console.log(`[Indexing] Sitemap submitted: ${sitemapUrl}`);
  } catch (err: any) {
    console.error("[Indexing] Failed (non-fatal):", err?.message || err);
  }
}
