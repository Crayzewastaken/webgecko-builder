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
${serpGuidance}${lsiInstruction}
RULES:
1. JSON only — no markdown, no backticks. Start with { end with }
2. Inside string values use only single quotes
3. No markdown (** or *) anywhere
4. stitchPrompt MUST follow the EXACT STRUCTURE SCAFFOLD below — this is non-negotiable

CRITICAL VISUAL & CODE RULES — the stitchPrompt MUST enforce ALL of these:
A. FONTS & TYPOGRAPHY SCALE:
   - For 'modern premium' or 'tech' styles: Use ONLY 'Space Grotesk' for headings (h1, h2, h3) and 'Inter' for body, nav, buttons, and forms.
   - For 'vintage' or 'editorial' styles: Use elegant serif headings ('Playfair Display' or 'Lora') and clean 'Inter' for body text.
   - Strictly apply this typographic scale: Hero H1 must be exactly 4.5rem (72px) with line-height 1.1; Section H2 must be exactly 2.5rem (40px) with line-height 1.25; H3 subheadings must be exactly 1.5rem (24px); Body copy must be exactly 1.05rem (16.8px) with line-height 1.6 and letter-spacing -0.011em for high-premium legibility. Never use Arial, Helvetica, or browser defaults.
B. 8px RIGID SPACING SCALE & GRID SYSTEM:
   - Abandon standard/arbitrary padding. All layouts must strictly map spacing, margins, padding, and grid gaps to an 8px grid system (8px, 16px, 24px, 32px, 48px, 64px, 80px, 96px, 128px).
   - Section vertical paddings must be exactly 96px desktop (80px mobile). Card inner padding must be exactly 32px (or 24px). Grid gaps must be exactly 32px.
C. PREMIUM CARD COMPONENT SYSTEM (Shadcn UI style):
   - SURFACE = palette.surface colour; BACKGROUND = palette.background colour.
   - All cards on all pages must have: background:SURFACE; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,0.18); transition:box-shadow 0.2s ease, transform 0.2s ease.
   - Card Hover: transform:translateY(-2px); box-shadow:0 12px 32px rgba(0,0,0,0.28); border-color:rgba(255,255,255,0.15).
   - If style is 'vintage': use sharp card edges (border-radius:0px), high-contrast borders (1px solid palette.accent), and zero shadow.
D. INTENTIONAL BUTTON SYSTEM:
   - ALL action buttons across the entire website must be strictly unified (use palette.accent colour for ACCENT):
   - Primary: background:ACCENT; color:#fff; padding:14px 28px; border-radius:30px (rounded-full); font-weight:600; font-size:1rem; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:opacity 0.2s ease, transform 0.15s ease.
   - Primary hover: opacity:0.9; transform:translateY(-1px).
   - Ghost/secondary: background:transparent; border:1.5px solid ACCENT; color:ACCENT; padding:13px 27px; border-radius:30px; font-weight:600; font-size:1rem; cursor:pointer; transition:background 0.2s ease, color 0.2s ease.
   - Ghost hover: background:rgba(255,255,255,0.05); color:#fff.
E. NAV — The sticky header must be IDENTICAL on every page (BG = palette.background colour):
   - position:sticky;top:0;z-index:100;background:BG with e8 alpha;backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.07);padding:0 48px;height:68px;display:flex;align-items:center;justify-content:space-between;
   - Active nav link: color:ACCENT;font-weight:700;border-bottom:2px solid ACCENT;
   - Nav links call window.navigateTo('pageid') — never use href anchors for page navigation.
F. COLOR VARIABLES & THEMES:
   - Define custom CSS variables inside :root: --clr-bg (palette.background), --clr-surface (palette.surface), --clr-accent (palette.accent), --clr-text (palette.text), --clr-border: rgba(255,255,255,0.08). Use them dynamically.
G. NO placeholder images: never use picsum.photos, placehold.it, unsplash.com, or any generic fake image URL in src attributes.
H. RESPONSIVE CONSTRAINTS: Every single section must include @media(max-width:768px) blocks that collapse columns to a single column, reduce H1 to 2.8rem (44px), and adjust section vertical padding to 64px and card padding to 20px.

EXACT STRUCTURE SCAFFOLD — the stitchPrompt MUST describe rendering EXACTLY these elements in this order:

[1] STICKY HEADER
  - Logo text "${businessName}" left (font-weight: 700; font-size: 1.25rem)
  - Desktop nav links right: ${navPages}
  - Button id=hamburger class=md:hidden (hamburger icon ☰) — toggles mobile menu
  - div id=mobile-menu hidden by default, contains same nav links, close button aria-label=Close menu

[2] SECTION id=hero (full viewport height, visually striking — THIS IS THE MOST IMPORTANT SECTION)
  MANDATORY HERO COMPOSITIONS — do NOT produce a basic centered template:
  - Layout: TWO-COLUMN split composition.
  - Left Column (Text & Action Stack — width: 55%):
    a) A premium pill-shaped TRUST BADGE above the headline (e.g. "★★★★★ Rated 5.0 on Google" or "✓ AHPRA Registered ✓ Same-Day Appointments") styled with subtle borders and accented text.
    b) Large, bold headline (benefit-driven, max 8 words, NO address) — font-size: 4.5rem; line-height: 1.1; letter-spacing: -0.02em. Use a subtle @keyframes fadeInUp fade-in animation on load.
    c) Subheadline (value prop, NO address) — muted colour, 1.15rem, margin-top: 16px.
    d) TWO CTA buttons side by side (margin-top: 32px): PRIMARY button (accent background, "${ctaText || "Get Started"}") with an SVG arrow icon + SECONDARY ghost button ("Learn More").
    e) Horizontal SOCIAL PROOF stat bar (margin-top: 48px): 3-4 statistics side-by-side with large accented numbers (e.g., "5k+ Patients", "24/7 Available", "100% Guaranteed").
  - Right Column (Visual Element Stack — width: 45%):
    ${heroUrl ? `- Sticky visual card container showing exactly this hero image URL — ${heroUrl}` : "- Dynamic, state-of-the-art interactive element: a floating multi-layered dashboard preview mock, bento-inspired feature cards, or a mesh animated gradient card with floating badge highlights (e.g., 'Next slot: 2pm today') overlapping via absolute positioning. No fakes or generic placeholders."}
  - Background Layer: Subtle slow-pulsing animated radial backdrop gradient (@keyframes slowPulse) for modern depth.
  - HERO SECTION HEIGHT: min-height: 100vh with display:flex; align-items:center; justify-content:space-between; gap:48px.

[3] SECTION id=about (2-column layout)
  - Left side: Large elegant H2 heading + 2-3 paragraph copy with high-quality spacing.
  - Right side: Why Choose Us checklist. 3 beautiful vertical stack feature blocks with custom emoji or icons, small bold subtitles, and 1-sentence value descriptions.

[4] SECTION id=services
  - Heading: "Our Services" (centered or left-aligned, accompanied by a descriptive pill badge).
  - ASYMMETRICAL COMPOSITION / BENTO GRID: Construct the services layout as a gorgeous bento-grid. Draw 3 columns. Render service cards with asymmetrical widths or heights (e.g., one highlighted 2/3-width primary service card and two smaller 1/3-width cards) OR a pristine 3-column structural layout with sharp or precise border-radius card blocks, 1px border lines instead of soft shadows.
  - Each card: high-fidelity custom border, custom icon, bold title, elegant description, and an inline chevron text-link ("Explore service →").
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
    const multiPagePrefix = "⚠️ MULTI-PAGE SITE — MANDATORY STRUCTURE ⚠️\nThis is a " + pages.length + "-page site. You MUST output " + pages.length + " separate top-level divs:\n" + multiPageDivs + "\nNav links use onclick='navigateTo(\"" + pageIds.split(", ")[0] + "\")' etc. NO anchor scroll links. Do NOT define navigateTo() or .page-section CSS.\n\n";
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
}
