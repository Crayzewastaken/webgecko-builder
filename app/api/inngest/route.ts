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

      let bookingWidgetHtml = "";
      if (hasBookingFeature) {
        try {
          const services = getServicesForIndustry(userInput.industry);
          bookingWidgetHtml = generateBookingWidget({
            jobId, businessName: userInput.businessName,
            timezone: "Australia/Brisbane",
            services, primaryColor: "#10b981",
            apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app",
          });
        } catch (e) { console.error("Booking widget failed:", e); }
      }

      const fixPrompt = `You are a STRICT HTML post-processor for a production web design system.
You are NOT a designer. You must NOT change layout, structure, styling, or Tailwind classes.
Preserve the Stitch-generated HTML EXACTLY except for the specific fixes below.

=== HARD RULES ===
- DO NOT move elements, redesign sections, change Tailwind classes, or rename IDs
- DO NOT convert onclick="navigateTo(...)" to href links
- DO NOT invent new sections or add features not listed
- PRESERVE all content, copy, images, colors from Stitch
- NEVER create a duplicate id — if an element already has an id, do not add the same id elsewhere
- NEVER nest an element with id="X" inside another element that already has id="X"

=== EXISTING IDs IN THIS HTML ===
These IDs already exist: ${existingIdsStr}
Do NOT add these IDs anywhere else in the document.

=== NAVIGATE-TO ID FIX ===
These navigateTo() calls have NO matching id element and MUST be fixed: ${missingIds.length > 0 ? missingIds.join(", ") : "none — all IDs are present"}

For each missing id:
1. FIRST: scan the HTML for a section whose heading text or class name semantically matches the id (e.g. navigateTo('contact') → find a section with "Contact" heading or class containing "contact")
2. If found: add id="[missing_id]" to that section's opening tag (only if it doesn't already have an id)
3. If not found: add a new page-section div with that id BEFORE </body>: <div class="page-section" id="[missing_id]" style="display:none;padding:80px 24px;"></div>

=== CTA BUTTON FIX ===
Hero CTA buttons with href="#" or no action (text: Join Now, Book Now, Get Started, Sign Up, etc.):
- If id="booking" exists in the existing IDs above: add onclick="window.navigateTo('booking')"
- Else: add onclick="window.navigateTo('contact')"

=== CONTACT DETAILS ===
Replace placeholder emails/phones:
- Any example@, info@, hello@, contact@ → ${clientEmail}
- Any 555-, (555), fake numbers → ${clientPhone}

=== MULTI-PAGE: "${userInput.siteType.toUpperCase()}" ===
${isMultiPage
  ? `Ensure page divs have class="page-section" and ids matching: ${pageList}. Only first page visible (display:block), others display:none. Keep all onclick="navigateTo(...)" exactly as-is.`
  : `Single page, all sections visible, nav uses href="#sectionid".`}

${googleMapsEmbed ? `=== MAP ===\nInject inside existing map/location section: ${googleMapsEmbed}` : ""}

${hasBookingFeature && bookingWidgetHtml
  ? `=== BOOKING ===\nFind the existing element with id="booking" in the HTML. Replace ONLY its inner content with the widget below. DO NOT create a new id="booking" element. DO NOT wrap it in another element with id="booking".\n${bookingWidgetHtml.substring(0, 3000)}`
  : ""}

=== OUTPUT ===
Return FULL HTML document. No explanations, no markdown, no backticks. Must start with <!DOCTYPE html> or <html>.

HTML TO PROCESS:
${stitchHtml.substring(0, 72000)}`;

      const fixResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
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

    // ── STEP 6-7: Link check + inject essentials ──────────────────────────────
    const finalHtml = await step.run("step6-inject", async () => {
      const { html: checkedHtml } = checkAndFixLinks(
        fixedHtml,
        Array.isArray(userInput.pages) ? userInput.pages : []
      );
      const ga4Id = job.ga4Id || userInput.ga4Id || "";
      let html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id);
      html = injectImages(html, logoUrl, heroUrl, photoUrls, productsWithPhotos);
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
