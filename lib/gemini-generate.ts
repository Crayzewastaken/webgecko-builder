// lib/gemini-generate.ts
// Direct Gemini 2.5 Pro HTML generation — replaces Stitch SDK
// ~15-45s vs 3-5 min with Stitch, no transport errors, explicit section control

export interface GeminiSiteSpec {
  projectTitle: string;
  stitchPrompt: string;
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
    heroSize?: string;
  };
  sections: string[];
  tone: string;
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  uniqueDesignIdea: string;
}

export interface GeminiGenerateOptions {
  spec: GeminiSiteSpec;
  userInput: {
    businessName: string;
    industry: string;
    phone?: string;
    email?: string;
    address?: string;
    pages?: string[];
    shopProducts?: string;
    bookingServices?: string;
    testimonials?: string;
  };
  isMultiPage: boolean;
  revisionNotes?: string;
  existingHtml?: string; // if rebuilding
}

/**
 * Generate a complete website HTML using Gemini 2.5 Pro directly.
 * Returns raw HTML string ready for the rest of the pipeline.
 */
export async function generateWithGemini(opts: GeminiGenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const { spec, userInput, isMultiPage, revisionNotes, existingHtml } = opts;
  const { palette, typography } = spec;

  const sectionList = (spec.sections && spec.sections.length > 0)
    ? spec.sections
    : ["hero", "about", "services", "testimonials", "faq", "contact"];

  // Build a nav structure list for multi-page
  const navItems = sectionList
    .map(id => `<li><a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${id}')" style="color:inherit;text-decoration:none;">${id.charAt(0).toUpperCase() + id.slice(1)}</a></li>`)
    .join("\n    ");

  const multiPageScript = isMultiPage ? `
// Multi-page navigation
window.navigateTo = function(id) {
  document.querySelectorAll('.page-section').forEach(function(s) {
    s.style.display = 'none';
  });
  var target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0,0);
  }
};
// Show home on load
document.addEventListener('DOMContentLoaded', function() {
  window.navigateTo('home');
});` : "";

  const pageAttr = (id: string) => isMultiPage
    ? `data-page="${id}" id="${id}" class="page-section"`
    : `id="${id}"`;

  const sectionDisplayStyle = isMultiPage ? 'style="display:none"' : '';
  const heroDisplayStyle = isMultiPage ? 'style="display:block"' : '';

  // Rebuild instructions
  const rebuildInstructions = existingHtml && revisionNotes
    ? `\n\nREVISION REQUEST: This is a rebuild. Apply these changes: ${revisionNotes}\nPreserve the existing design style and colour scheme.`
    : "";

  const prompt = `You are an expert full-stack web developer generating a COMPLETE, PRODUCTION-READY website.

BUSINESS BRIEF:
${spec.stitchPrompt}

BUSINESS DETAILS:
- Business: ${userInput.businessName}
- Industry: ${userInput.industry}
- Phone: ${userInput.phone || "Not provided"}
- Email: ${userInput.email || "Not provided"}
- Address: ${userInput.address || "Not provided"}
${userInput.testimonials ? `- Real testimonials: ${userInput.testimonials.slice(0, 400)}` : ""}
${userInput.shopProducts ? `- Products/Services: ${userInput.shopProducts.slice(0, 300)}` : ""}
${userInput.bookingServices ? `- Booking services: ${userInput.bookingServices.slice(0, 200)}` : ""}
${rebuildInstructions}

DESIGN SYSTEM:
- Background: ${palette.background}
- Surface/cards: ${palette.surface}
- Primary accent: ${palette.accent}
- Primary brand: ${palette.primary}
- Text colour: ${palette.text}
- Heading font: ${typography.headingFont}
- Body font: ${typography.bodyFont}
- Design concept: ${spec.uniqueDesignIdea}
- Tone: ${spec.tone}

HERO CONTENT:
- Headline: ${spec.heroHeadline}
- Subheadline: ${spec.heroSubheadline}
- CTA button: ${spec.ctaText}

REQUIRED PAGE SECTIONS (in order): ${sectionList.join(", ")}
PAGE STRUCTURE: ${isMultiPage ? "MULTI-PAGE SPA — each section has data-page='id' id='id' class='page-section'. Nav uses window.navigateTo(id)." : "SINGLE-PAGE — all sections visible, nav uses href='#id' anchor links."}

TECHNICAL REQUIREMENTS:
1. Complete <!DOCTYPE html> document — NO markdown, NO code fences, ONLY valid HTML
2. Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
3. Tailwind config block that sets the design colours as CSS variables AND extends theme.colors
4. Google Fonts import for ${typography.headingFont} and ${typography.bodyFont}
5. EVERY section has data-page="sectionid" AND id="sectionid" (lowercase, hyphen-separated)
6. Mobile-first responsive — works perfectly on phone screens
7. A header/navbar with logo "${userInput.businessName}" and links to ALL sections
8. Contact section MUST have: working HTML form, phone ${userInput.phone || ""}, email ${userInput.email || ""}${userInput.address ? `, address ${userInput.address}` : ""}
9. Footer with phone, email, copyright ${userInput.businessName}
10. JSON-LD LocalBusiness schema in <head> with real phone/email/address
11. Placeholder images use: https://picsum.photos/seed/UNIQUE_SEED/800/500 (vary seeds)
12. NO placeholder text like "Lorem ipsum" — use realistic industry-specific copy
13. Services section: at least 6 service cards with real service names for ${userInput.industry}
14. Testimonials: at least 4 testimonial cards with star ratings
15. FAQ: at least 8 questions relevant to ${userInput.industry}
16. About section: compelling company story, team, values
17. Make the site LARGE and DETAILED — minimum 200+ lines of content HTML

COLOUR APPLICATION:
- Page background: ${palette.background} (use as body background and section backgrounds)
- Card/surface background: ${palette.surface}
- Accent/CTA buttons: ${palette.accent}
- Body text: ${palette.text}
- Use semi-transparent overlays for hero sections

STRUCTURE PATTERN FOR MULTI-PAGE:
${isMultiPage ? `<div class="page-section" data-page="home" id="home" style="display:block"><!-- hero content --></div>
<div class="page-section" data-page="about" id="about" style="display:none"><!-- about content --></div>
etc.` : `<section id="home"><!-- hero --></section>
<section id="about"><!-- about --></section>
etc.`}

Return ONLY the complete HTML. Start with <!DOCTYPE html> and end with </html>.`;

  const body = {
    contents: [
      {
        role: "user" as const,
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 65536,
      responseMimeType: "text/plain",
    },
    systemInstruction: {
      parts: [{ text: "You are an expert web developer. Output ONLY valid HTML — no markdown, no explanation, no code fences. Start your response with <!DOCTYPE html>." }]
    }
  };

  // Try gemini-2.5-pro first, fall back to gemini-2.5-flash
  const models = ["gemini-2.5-pro", "gemini-2.5-flash"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      console.log(`[GeminiGenerate] Calling ${model} for ${userInput.businessName}...`);

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000), // 4 minute timeout per attempt
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini ${model} error ${resp.status}: ${errText.slice(0, 400)}`);
      }

      const data = await resp.json();

      // Handle safety blocks
      if (data?.candidates?.[0]?.finishReason === "SAFETY") {
        throw new Error(`Gemini ${model} blocked by safety filter`);
      }

      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text || text.length < 1000) {
        throw new Error(`Gemini ${model} returned empty/short response (${text.length} chars)`);
      }

      // Strip accidental markdown fences
      let html = text
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Ensure starts with <!DOCTYPE
      if (!html.toLowerCase().startsWith("<!doctype")) {
        const doctypeIdx = html.toLowerCase().indexOf("<!doctype");
        if (doctypeIdx > 0) {
          html = html.slice(doctypeIdx);
        } else {
          throw new Error(`Gemini ${model} did not return HTML (starts with: ${html.slice(0, 100)})`);
        }
      }

      if (!html.includes("<body") || !html.includes("</html>")) {
        throw new Error(`Gemini ${model} HTML is incomplete (missing <body> or </html>)`);
      }

      console.log(`[GeminiGenerate] ${model} success — ${html.length} chars`);
      return html;

    } catch (err: any) {
      console.warn(`[GeminiGenerate] ${model} failed: ${err?.message}`);
      lastError = err;
      // Small delay before trying next model
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

/**
 * Ask Gemini to refine/edit the generated HTML based on detected issues.
 * Faster than regenerating from scratch.
 */
export async function refineWithGemini(
  html: string,
  issues: string[],
  businessName: string
): Promise<string> {
  if (issues.length === 0) return html;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const prompt = `You are editing an HTML website for "${businessName}".

Fix ONLY these specific issues (keep everything else identical — colours, layout, all existing content):
${issues.map((iss, i) => `${i + 1}. ${iss}`).join("\n")}

RULES:
- Do NOT change the overall design, colours, or layout
- Do NOT add new sections unless specifically asked
- Keep all existing content intact
- Return the COMPLETE fixed HTML document

CURRENT HTML:
${html.slice(0, 90000)}`;

  const body = {
    contents: [{ role: "user" as const, parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536,
      responseMimeType: "text/plain",
    },
    systemInstruction: {
      parts: [{ text: "Output ONLY the complete fixed HTML. No explanations, no code fences." }]
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini refine error ${resp.status}: ${errText.slice(0, 400)}`);
  }

  const data = await resp.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text || text.length < html.length * 0.5) {
    console.warn(`[GeminiRefine] Response too short (${text.length} vs original ${html.length}) — keeping original`);
    return html;
  }

  let refined = text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!refined.toLowerCase().startsWith("<!doctype") && !refined.includes("<body")) {
    console.warn("[GeminiRefine] Refined output not valid HTML — keeping original");
    return html;
  }

  console.log(`[GeminiRefine] Refined HTML: ${html.length} → ${refined.length} chars`);
  return refined;
}
