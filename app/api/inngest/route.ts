// app/api/inngest/route.ts
export const maxDuration = 300; // max on Vercel Hobby; streaming keeps individual steps alive

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { Redis } from "@upstash/redis";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import {
  extractJson,
  safeFileName,
  extractCSS,
  checkAndFixLinks,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { generateBookingWidget } from "@/lib/booking-widget";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

// ─── Build Website (step-by-step, no global timeout) ──────────────────────────

const buildWebsite = inngest.createFunction(
  {
    id: "build-website",
    name: "Build Website",
    retries: 1,
    triggers: [{ event: "build/website" }],
  },
  async ({ event, step }: { event: { data: { jobId: string } }; step: any }) => {
    const { jobId } = event.data;

    // ── Load job ──────────────────────────────────────────────────────────────
    const job = await step.run("load-job", async () => {
      const j = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId);
      if (!j) throw new Error("Job not found: " + jobId);
      if (j.status === "building") throw new Error("Already building");
      if (j.status === "complete") throw new Error("Already complete");
      await redis.set(`job:${jobId}`, { ...j, status: "building" }, { ex: 86400 * 30 });
      return j;
    });

    const {
      userInput, logoUrl, heroUrl,
      photoUrls = [], productsWithPhotos = [],
      hasBooking, clientSlug,
      email: clientEmail, phone: clientPhone,
    } = job;

    const fileName = job.fileName || safeFileName(userInput.businessName);
    const features: string[] = Array.isArray(userInput.features) ? userInput.features : [];
    const hasBookingFeature = hasBooking || features.includes("Booking System");
    const isMultiPage = userInput.siteType === "multi";
    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";

    const method = userInput.pricingMethod || "manual";
    let pricingSection = "No pricing section needed.";
    if (userInput.hasPricing === "Yes") {
      if (method === "weknow") {
        pricingSection = `PRICING SECTION REQUIRED: Create a professional pricing section for a ${userInput.industry} business using realistic industry-standard pricing.`;
      } else if (method === "url") {
        pricingSection = `PRICING SECTION REQUIRED: Pull pricing from: ${userInput.pricingUrl}. If inaccessible, create a professional placeholder.`;
      } else if (method === "upload") {
        pricingSection = `PRICING SECTION REQUIRED: Client uploaded a price list. Create a professional pricing section for ${userInput.industry}.`;
      } else if (userInput.pricingType === "products" && productsWithPhotos.length > 0) {
        const productList = productsWithPhotos.map((p: any) => `${p.name}: ${p.price}${p.photoUrl ? ` (photo: ${p.photoUrl})` : ""}`).join(", ");
        pricingSection = `PRICING SECTION REQUIRED — Products: ${productList}. Display each with name, price and photo in a card grid.`;
      } else {
        pricingSection = `PRICING SECTION REQUIRED. Type: ${userInput.pricingType}. Details: ${userInput.pricingDetails}`;
      }
    }

    const imageSection = logoUrl || heroUrl || (photoUrls && photoUrls.length > 0)
      ? `CLIENT IMAGES — use these exact URLs: ${logoUrl ? `Logo: ${logoUrl}` : ""} ${heroUrl ? `Hero: ${heroUrl}` : ""} ${photoUrls && photoUrls.length > 0 ? `Photos: ${photoUrls.join(", ")}` : ""}`
      : "No client images provided — use relevant stock image placeholders.";

    // ── STEP 1: Claude spec ───────────────────────────────────────────────────
    const spec = await step.run("step1-claude-spec", async () => {
      const promptResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `Your response must be ONLY a JSON object. Start with { and end with }. No text before or after. No markdown. No backticks.

The JSON must have exactly two keys: "projectTitle" (short string) and "stitchPrompt" (detailed design brief string).

You are a senior UI designer. Design a premium, distinctive website for the business below. Research the ${userInput.industry} industry. Think about top-tier websites in this space. Create something better than average — distinctive, conversion-focused, and premium.

BUSINESS CONTEXT:
Business: ${userInput.businessName}
Industry: ${userInput.industry}
Target Audience: ${userInput.targetAudience || "general public"}
USP: ${userInput.usp || "quality service"}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Colours: ${userInput.colorPrefs || "professional palette"}
References: ${userInput.references || "none"}
Features: ${features.join(", ") || "contact form"}
Notes: ${userInput.additionalNotes || "none"}
Contact Email: ${clientEmail}
Contact Phone: ${clientPhone}

${pricingSection}
${hasBookingFeature ? `BOOKING: Include a booking section with id="booking". The booking widget will be injected here.` : ""}
${imageSection}

DESIGN REQUIREMENTS — include ALL in the stitchPrompt:
1. HERO: Full viewport height, bold headline 60-80px, subheadline, CTA button, distinctive background (gradient/dark overlay/pattern — NOT plain white)
2. NAV: Sticky, logo left, links right, CTA button, mobile hamburger id="hamburger" toggling id="mobile-menu", glassmorphism or solid dark background
3. LAYOUTS: Mix — full-width sections, 50/50 splits, asymmetric grids, stat counters, testimonials with names and star ratings
4. TYPOGRAPHY: Bold display font for headings, clean sans-serif body, generous spacing
5. COLOUR: Use ${userInput.colorPrefs || "professional premium palette"}, dark backgrounds where appropriate, accent colour for CTAs
6. TRUST: Star-rated testimonials with realistic Australian names, stats bar
7. CONTACT: Use REAL email ${clientEmail} and REAL phone ${clientPhone}, working contact form
8. FOOTER: Logo, links, contact, social, copyright

${isMultiPage
  ? `CRITICAL — MULTI-PAGE SITE: Pages: ${pageList}.
- Each page MUST be a div with class="page-section" and unique lowercase id (e.g. id="home", id="services")
- ONLY the first page div visible (style="display:block"), ALL others MUST have style="display:none"
- ALL nav links MUST use onclick="navigateTo('pageid')" — NOT href links
- Add id="hamburger" button toggling id="mobile-menu"`
  : `SINGLE PAGE SITE: Sections: ${pageList}. Each section has unique lowercase id. Nav links use href="#sectionid". Smooth scroll.`}

Make it premium, unique and conversion-focused for: ${userInput.businessName}`
        }]
      });
      const promptText = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
      return extractJson(promptText);
    });

    console.log(`[Inngest] STEP 1 DONE: ${spec.projectTitle}`);

    // ── STEP 2: Create Stitch project ─────────────────────────────────────────
    const projectId = await step.run("step2-stitch-create", async () => {
      const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
      const pid = project?.name?.split("/")[1];
      if (!pid) throw new Error("Stitch: no projectId returned");
      return pid;
    });

    console.log(`[Inngest] STEP 2 DONE: ${projectId}`);

    // ── STEP 3: Stitch generate screen (slow — gets its own step) ─────────────
    const downloadUrl = await step.run("step3-stitch-generate", async () => {
      const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
        projectId,
        prompt: spec.stitchPrompt,
      });
      const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
      if (!screens.length) throw new Error("Stitch: no screens returned");
      const url = screens[0]?.htmlCode?.downloadUrl;
      if (!url) throw new Error("Stitch: no downloadUrl");
      return url;
    });

    console.log(`[Inngest] STEP 3 DONE`);

    // ── STEP 4: Fetch HTML ────────────────────────────────────────────────────
    const stitchHtml = await step.run("step4-fetch-html", async () => {
      const html = await fetch(downloadUrl).then(r => r.text());
      if (!html || html.length < 100) throw new Error("Stitch HTML empty or too short");
      return html;
    });

    console.log(`[Inngest] STEP 4 DONE. Length: ${stitchHtml.length}`);

    // ── STEP 5: Claude fix pass ───────────────────────────────────────────────
    const fixedHtml = await step.run("step5-claude-fix", async () => {
      const businessAddress = userInput.businessAddress || "";
      const googleMapsEmbed = businessAddress && process.env.GOOGLE_MAPS_API_KEY
        ? `<iframe width="100%" height="350" style="border:0;border-radius:12px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe>`
        : "";

      const existingIds = [...stitchHtml.matchAll(/\bid="([^"]+)"/g)].map((m: RegExpMatchArray) => m[1]);
      const existingIdsStr = existingIds.join(", ");
      const navigateCalls = [...new Set([...stitchHtml.matchAll(/navigateTo\(['"]([^'"]+)['"]\)/g)].map((m: RegExpMatchArray) => m[1]))];
      const missingIds = navigateCalls.filter((id: string) => !existingIds.includes(id));

      const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

      const fixPrompt = `You are a STRICT HTML post-processor for a production web design system. Your job is surgical fixes only — do NOT redesign, restyle, or restructure anything.

════════════════════════════════════════
SYSTEM ARCHITECTURE — READ FIRST
════════════════════════════════════════
This site uses a custom WebGecko backend. These APIs already exist and MUST be used:
- Booking: POST /api/book  |  Availability: GET /api/availability?jobId=...&date=...
- Forms: handled by inline JS (no external services)
- Navigation: window.navigateTo(pageId) — already injected after this step
- Hamburger: #hamburger toggles #mobile-menu — already handled after this step

CRITICAL — BOOKING SYSTEM RULES:
- ${hasBookingFeature ? "This site HAS a booking system. The booking widget will be injected AFTER this step by code — NOT by you." : "This site does NOT have a booking system."}
- NEVER add Cal.com, Calendly, or any other external booking service
- NEVER generate fake booking modals, calendars, or booking forms in the HTML
- NEVER add any booking-related HTML at all — it is handled externally
- ALL hero/CTA buttons with booking intent must use ONLY: onclick="window.navigateTo('${bookingNavTarget}')"
- Do NOT add any other onclick or href to booking buttons

════════════════════════════════════════
HARD RULES — DO NOT BREAK ANY OF THESE
════════════════════════════════════════
1. DO NOT change layout, Tailwind classes, colors, fonts, or section structure
2. DO NOT rename, move, or duplicate any id attribute
3. DO NOT add onclick="navigateTo(...)" to elements that already have one
4. DO NOT replace existing onclick="navigateTo(...)" with href links
5. DO NOT invent sections, pages, or features not listed below
6. DO NOT add external scripts (no CDN links, no third-party embeds except Google Maps if provided)
7. NEVER nest id="X" inside another element that already has id="X"
8. PRESERVE all Stitch-generated copy, images, testimonials, stats, and colors exactly

════════════════════════════════════════
EXISTING IDs IN THIS HTML
════════════════════════════════════════
These ids already exist — DO NOT add them anywhere else:
${existingIdsStr}

════════════════════════════════════════
FIX 1 — MISSING navigateTo() TARGETS
════════════════════════════════════════
These navigateTo() calls have no matching id and MUST be resolved:
${missingIds.length > 0 ? missingIds.map(id => `- navigateTo('${id}') → no element with id="${id}" exists`).join("\n") : "NONE — all navigation targets are present, skip this fix"}

Resolution order (try each in sequence, stop when resolved):
A. Find a <section>, <div>, <article>, or <main> whose class/data attribute CONTAINS "${missingIds[0] || "id"}" — add id="[missing_id]" to its opening tag if it has no id
B. Find a section containing an <h1>, <h2>, or <h3> whose text matches the id name — add id="[missing_id]" to that section's opening tag if it has no id
C. Find the first <div class="page-section"> that has no id — add id="[missing_id]" to it
D. ONLY if A/B/C all fail: inject before </body>: <div class="page-section" id="[missing_id]" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;text-align:center;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:700;">[Section Name]</h2></div></div>

════════════════════════════════════════
FIX 2 — CTA BUTTONS
════════════════════════════════════════
Find hero/header CTA buttons with href="#" or no action. These are buttons with text like:
"Book Now", "Book a Session", "Get Started", "Join Now", "Sign Up", "Free Trial", "Book Free", "Reserve", "Enquire Now", "Get a Quote", "Start Today"

For each found:
- Remove href="#" (or set href="javascript:void(0)")
- Add: onclick="window.navigateTo('${bookingNavTarget}')"
- DO NOT touch buttons that already have onclick="navigateTo(...)"
- DO NOT touch nav links, footer links, or social buttons

════════════════════════════════════════
FIX 3 — CONTACT DETAILS
════════════════════════════════════════
Replace ALL placeholder contact info:
- Emails matching: example@*, *@example.com, hello@company*, info@company*, contact@company* → ${clientEmail}
- Phones matching: 555-*, (555)*, +1 555*, fake AU numbers like 0400 000 000 → ${clientPhone}
- Keep the real client email/phone if already correct: ${clientEmail} / ${clientPhone}

════════════════════════════════════════
FIX 4 — PAGE/SECTION STRUCTURE (${userInput.siteType.toUpperCase()})
════════════════════════════════════════
${isMultiPage
  ? `MULTI-PAGE SITE. Pages required: ${pageList}
- Each page div must have class="page-section" and a unique lowercase id matching the page name
- ONLY the first page div should be visible (style="display:block"), all others style="display:none"
- All nav links must use onclick="navigateTo('pageid')" — NOT href
- Keep all existing onclick="navigateTo(...)" exactly as-is`
  : `SINGLE-PAGE SITE. All sections remain visible.
- Nav links should use href="#sectionid" for smooth scroll
- Do NOT add page-section classes or display:none to sections`}

${googleMapsEmbed
  ? `════════════════════════════════════════
FIX 5 — GOOGLE MAPS
════════════════════════════════════════
Find the map/location/directions section in the HTML. Replace any placeholder map or map container's inner content with this embed:
${googleMapsEmbed}`
  : ""}


════════════════════════════════════════
VALIDATION CHECKLIST (run before output)
════════════════════════════════════════
Before returning, verify:
[ ] All navigateTo('x') calls have a matching id="x" element
[ ] No button has href="#" without an onclick (except anchors with real href targets)
[ ] No duplicate id attributes exist anywhere
[ ] Contact email is ${clientEmail} and phone is ${clientPhone}
[ ] No Cal.com, Calendly, or external booking embeds added
[ ] All Stitch layout/styling preserved exactly

════════════════════════════════════════
OUTPUT
════════════════════════════════════════
Return the COMPLETE HTML document with ONLY the fixes above applied.
- No explanations, no markdown, no code fences, no backticks
- Must start with <!DOCTYPE html> or <html>
- Must include the complete <head>, all <style> blocks, all <script> blocks, and complete <body>

HTML TO PROCESS:
${stitchHtml.substring(0, 40000)}`;

      const fixResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 12000,
        messages: [{ role: "user", content: fixPrompt }],
      });

      let html = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : "";
      html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      if (!html || (!html.includes("<html") && !html.includes("<!DOCTYPE") && !html.includes("<body"))) {
        console.log(`[Inngest] STEP 5: Fix response invalid, using original Stitch HTML`);
        return stitchHtml;
      }
      return html;
    });

    console.log(`[Inngest] STEP 5 DONE. Length: ${fixedHtml.length}`);

    // ── STEP 6: Link check + inject essentials + booking widget ──────────────
    const finalHtml = await step.run("step6-inject", async () => {
      const { html: checkedHtml } = checkAndFixLinks(
        fixedHtml,
        Array.isArray(userInput.pages) ? userInput.pages : []
      );
      const ga4Id = job.ga4Id || userInput.ga4Id || "";
      let html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id);
      html = injectImages(html, logoUrl, heroUrl, photoUrls, productsWithPhotos);

      // ── Booking widget injection (done by code, never by Claude) ────────────
      if (hasBookingFeature) {
        try {
          const services = getServicesForIndustry(userInput.industry);
          const bookingWidgetHtml = generateBookingWidget({
            jobId,
            businessName: userInput.businessName,
            timezone: "Australia/Brisbane",
            services,
            primaryColor: "#10b981",
            apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app",
          });

          // Strategy 1: replace inner content of existing id="booking" element
          const bookingElMatch = html.match(/<([a-z][a-z0-9]*)[^>]*\sid="booking"[^>]*>([\s\S]*?)<\/\1>/i);
          if (bookingElMatch) {
            const fullMatch = bookingElMatch[0];
            const tag = bookingElMatch[1];
            const openTagEnd = fullMatch.indexOf(">") + 1;
            const openTag = fullMatch.substring(0, openTagEnd);
            const closeTag = `</${tag}>`;
            html = html.replace(fullMatch, openTag + "\n" + bookingWidgetHtml + "\n" + closeTag);
            console.log("[Inngest] Booking widget injected into existing #booking element");
          } else {
            // Strategy 2: insert the full widget before </body>
            html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
            console.log("[Inngest] Booking widget injected before </body> (no #booking element found)");
          }
        } catch (e) {
          console.error("[Inngest] Booking widget injection failed:", e);
        }
      }

      return html;
    });

    // ── STEP 8: Deploy to Vercel ──────────────────────────────────────────────
    const previewUrl = await step.run("step8-deploy", async () => {
      const safeName = fileName.slice(0, 40);
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${safeName}-${Date.now()}`,
          teamId: process.env.VERCEL_TEAM_ID,
          files: [{ file: "index.html", data: finalHtml, encoding: "utf-8" }],
          projectSettings: { framework: null, outputDirectory: "./" },
        }),
      });
      if (!deployRes.ok) {
        console.error("[Inngest] Deploy failed:", await deployRes.text());
        return "";
      }
      const deployData = await deployRes.json();
      return `https://${deployData.url}`;
    });

    console.log(`[Inngest] STEP 8 DONE: ${previewUrl}`);

    // ── STEP 9: Save to Redis ─────────────────────────────────────────────────
    await step.run("step9-save", async () => {
      await redis.set(`job:${jobId}`, {
        ...job,
        html: finalHtml,
        title: spec.projectTitle,
        fileName,
        status: "complete",
        previewUrl,
        builtAt: new Date().toISOString(),
      }, { ex: 86400 * 30 });

      if (clientSlug) {
        const existingClient = await redis.get<any>(`client:${clientSlug}`);
        if (existingClient) {
          await redis.set(`client:${clientSlug}`, {
            ...existingClient,
            previewUrl,
            buildStatus: "complete",
            builtAt: new Date().toISOString(),
          });
        }
      }
    });

    // ── STEP 10: Email owner ──────────────────────────────────────────────────
    await step.run("step10-email", async () => {
      const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
      const secret = encodeURIComponent(process.env.PROCESS_SECRET || "");
      const processUrl = `${base}/api/fix?id=${jobId}&secret=${secret}`;
      const unlockUrl = `${base}/api/payment/unlock?jobId=${jobId}&secret=${secret}`;
      const releaseUrl = `${base}/api/unlock/release?jobId=${jobId}&secret=${secret}`;
      const adminUrl = `${base}/admin?secret=${secret}`;
      const cssContent = extractCSS(fixedHtml);

      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `✅ Build Complete — ${spec.projectTitle}`,
        html: `
          <h2>Website Built — ${spec.projectTitle}</h2>
          <p><strong>Client:</strong> ${userInput.name} (${clientEmail})</p>
          <p><strong>Business:</strong> ${userInput.businessName}</p>
          <p><strong>Industry:</strong> ${userInput.industry}</p>
          <p><strong>Pages:</strong> ${pageList}</p>
          <p><strong>Features:</strong> ${features.join(", ") || "-"}</p>
          ${previewUrl ? `<p><a href="${previewUrl}" style="color:#22c55e;">🌐 View Preview</a></p>` : ""}
          <br/>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <a href="${releaseUrl}" style="background:#00c896;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">📤 Release to Client</a>
            <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔧 Fix This Site</a>
            <a href="${unlockUrl}" style="background:#8b5cf6;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔓 Unlock Final Payment</a>
            <a href="${adminUrl}" style="background:#1e293b;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;border:1px solid #334155;">📊 Admin Dashboard</a>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin-top:12px;">Admin dashboard (bookmark this): <a href="${adminUrl}" style="color:#00c896;">${adminUrl}</a></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:4px;">HTML and CSS files attached below.</p>
        `,
        attachments: [
          { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
          { filename: `${fileName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
        ],
      });
    });

    console.log(`[Inngest] Build COMPLETE for jobId=${jobId}`);
    return { success: true, jobId };
  }
);

// ─── Monthly Analytics Reports ────────────────────────────────────────────────

const monthlyReports = inngest.createFunction(
  {
    id: "monthly-analytics-reports",
    name: "Send Monthly Analytics Reports",
    triggers: [{ cron: "0 22 28-31 * *" }],
  },
  async ({ step }: { step: any }) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    if (tomorrow.getUTCDate() !== 1) {
      return { skipped: true, reason: "Not the last day of the month" };
    }

    const clientKeys: string[] = await step.run("scan-clients", async () => {
      let cursor = 0;
      const keys: string[] = [];
      do {
        const [nextCursor, batch] = await redis.scan(cursor, { match: "client:*", count: 100 });
        cursor = Number(nextCursor);
        keys.push(...(batch as string[]));
      } while (cursor !== 0);
      return keys;
    });

    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
    const secret = process.env.PROCESS_SECRET || "";

    for (const key of clientKeys) {
      const slug = key.replace("client:", "");
      await step.run("send-report-" + slug, async () => {
        const clientData = await redis.get<any>(key);
        if (!clientData || !clientData.jobId) return { skipped: true };
        const url = base + "/api/analytics/monthly?jobId=" + clientData.jobId + "&secret=" + encodeURIComponent(secret) + "&send=true";
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        console.log("[MonthlyReport] " + slug + ":", json);
        return json;
      });
    }

    return { sent: clientKeys.length };
  }
);


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports],
  streaming: true,
});
