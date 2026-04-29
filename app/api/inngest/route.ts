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

    // Derive a stable domain slug from their desired domain, e.g. "ironcorefitness.com.au" → "ironcorefitness"
    // This becomes the Vercel project name so the preview URL is always predictable
    const rawDomain: string = (userInput.domain || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const domainSlug: string = rawDomain
      ? rawDomain.replace(/\.(com\.au|net\.au|org\.au|com|net|org|io|au)$/i, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
      : fileName.slice(0, 40);
    // Vercel project name: "wg-" prefix + slug, max 52 chars, must be stable across redeploys
    const vercelProjectName = ("wg-" + domainSlug).slice(0, 52);
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
3. LAYOUTS: Mix — full-width sections, 50/50 splits, asymmetric grids, stat counters
4. TYPOGRAPHY: Bold display font for headings, clean sans-serif body, generous spacing
5. COLOUR: Use ${userInput.colorPrefs || "professional premium palette"}, dark backgrounds where appropriate, accent colour for CTAs
6. TESTIMONIALS & REVIEWS: Large testimonials section with id="testimonials" — minimum 3 star-rated reviews from realistic Australian names (e.g. "Sarah M.", "James T."), 5-star ratings shown as filled stars ★★★★★, with job titles or context, card or quote layout
7. FAQ SECTION: Accordion FAQ section with id="faq" — minimum 6 realistic Q&A pairs relevant to ${userInput.industry}, expandable/collapsible with smooth animation
8. PHOTO GALLERY: ${features.includes("Photo Gallery") ? `Gallery section with id="gallery" — image grid showing work/products/space` : "Skip gallery section"}
9. CONTACT: Use REAL email ${clientEmail} and REAL phone ${clientPhone}, working contact form with id="contact"
10. FOOTER: Logo, links, contact, social icons, copyright ${new Date().getFullYear()}
11. STATS BAR: Horizontal stats strip with 3-4 numbers (years experience, clients served, etc.)
12. BUSINESS NAME: The site title, logo text, and all headings MUST use the EXACT business name: "${userInput.businessName}" — do NOT use placeholder names

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
      const MAX_ATTEMPTS = 4;
      const RETRY_DELAYS_MS = [15_000, 30_000, 60_000]; // wait between attempts

      let lastError: Error = new Error("Stitch: unknown failure");

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`[Inngest] STEP 3: Stitch generate attempt ${attempt}/${MAX_ATTEMPTS}`);
          const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
            projectId,
            prompt: spec.stitchPrompt,
          });

          // Check for explicit error response
          if (stitchResult?.code === "UNKNOWN_ERROR" || stitchResult?.suggestion === undefined && stitchResult?.recoverable === false) {
            throw new Error(`Stitch service unavailable (attempt ${attempt}): ${JSON.stringify(stitchResult)}`);
          }

          const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
          if (!screens.length) throw new Error(`Stitch: no screens returned (attempt ${attempt})`);
          const url = screens[0]?.htmlCode?.downloadUrl;
          if (!url) throw new Error(`Stitch: no downloadUrl (attempt ${attempt})`);
          console.log(`[Inngest] STEP 3: Stitch succeeded on attempt ${attempt}`);
          return url;
        } catch (err: any) {
          lastError = err;
          const isServiceUnavailable =
            err?.message?.includes("unavailable") ||
            err?.message?.includes("UNKNOWN_ERROR") ||
            err?.code === "UNKNOWN_ERROR";

          console.warn(`[Inngest] STEP 3 attempt ${attempt} failed: ${err?.message}`);

          if (attempt < MAX_ATTEMPTS && isServiceUnavailable) {
            const delay = RETRY_DELAYS_MS[attempt - 1] ?? 60_000;
            console.log(`[Inngest] STEP 3: waiting ${delay / 1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Non-recoverable error or out of retries — fail the step
            break;
          }
        }
      }

      throw new Error(`Stitch generate_screen_from_text failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError.message}`);
    });

    console.log(`[Inngest] STEP 3 DONE`);

    // ── STEP 4: Fetch HTML ────────────────────────────────────────────────────
    const stitchHtml = await step.run("step4-fetch-html", async () => {
      const html = await fetch(downloadUrl).then(r => r.text());
      if (!html || html.length < 100) throw new Error("Stitch HTML empty or too short");
      return html;
    });

    console.log(`[Inngest] STEP 4 DONE. Length: ${stitchHtml.length}`);

    // ── STEP 5: Code-only fix pass (NO Claude — preserves Stitch design 100%) ──
    const fixedHtml = await step.run("step5-code-fix", async () => {
      let html = stitchHtml;
      const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

      // ── FIX 1: Contact details — replace fake/placeholder emails & phones ──
      // Emails: replace anything that looks like a placeholder
      html = html.replace(/\b[a-z]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample)\.com\b/gi, clientEmail);
      html = html.replace(/\binfo@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
      html = html.replace(/\bhello@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
      html = html.replace(/\bcontact@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
      // Phones: replace obvious fake AU numbers
      html = html.replace(/\b0[0-9]{3}\s000\s000\b/g, clientPhone);
      html = html.replace(/\b0400\s000\s000\b/g, clientPhone);
      html = html.replace(/\+61\s0[0-9]{3}\s000\s000/g, clientPhone);

      // ── FIX 2: CTA buttons — wire booking/enquiry CTAs ──
      const ctaKeywords = ['Book Now','Book a Session','Get Started','Join Now','Sign Up','Free Trial','Book Free','Reserve','Enquire Now','Get a Quote','Start Today','Book Today','Schedule Now','Try Free','Get Free Quote','Book Consultation'];
      const ctaPattern = new RegExp(`(<(?:a|button)[^>]*>\\s*(?:${ctaKeywords.join('|')})\\s*<\/(?:a|button)>)`, 'gi');
      html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
        const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
        if (isBooking && !attrs.includes('navigateTo') && !attrs.includes('onclick')) {
          return `<a${attrs} onclick="event.preventDefault();var el=document.getElementById('${bookingNavTarget}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${bookingNavTarget}');}">${inner}</a>`;
        }
        return match;
      });

      // ── FIX 3: Google Maps injection ──
      const businessAddress = userInput.businessAddress || "";
      if (businessAddress && process.env.GOOGLE_MAPS_API_KEY) {
        const mapsEmbed = `<iframe width="100%" height="350" style="border:0;border-radius:12px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe>`;
        // Find map placeholder sections and inject
        html = html.replace(/<div[^>]*(?:id|class)="[^"]*(?:map|location|directions)[^"]*"[^>]*>[\s\S]*?<\/div>/i, (match: string) => {
          if (!match.includes('iframe')) return match.replace(/<\/div>$/, mapsEmbed + '</div>');
          return match;
        });
      }

      // ── FIX 4: Strip any fake booking widgets Claude may have snuck in ──
      // Remove any Calendly/Cal.com embeds
      html = html.replace(/<script[^>]*calendly[^>]*>[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<link[^>]*calendly[^>]*/gi, '');
      html = html.replace(/<!--\s*Calendly[\s\S]*?-->/gi, '');

      console.log(`[Inngest] STEP 5 (code-only) DONE. Length: ${html.length}`);
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

      // ── Booking widget injection ─────────────────────────────────────────────
      // CRITICAL: Scripts injected via innerHTML don't execute.
      // We inject the widget as a self-contained <script> that:
      //   1. Creates the booking section DOM via document.createElement (not innerHTML)
      //   2. Replaces any existing #booking element, or appends before </body>
      //   3. Runs immediately at DOMContentLoaded
      if (hasBookingFeature) {
        try {
          const services = getServicesForIndustry(userInput.industry);
          const bookingWidgetHtml = generateBookingWidget({
            jobId,
            businessName: userInput.businessName,
            timezone: "Australia/Brisbane",
            services,
            primaryColor: "#10b981",
            apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au",
          });

          // Remove any existing fake booking section (Stitch placeholder or prior injection)
          // but preserve the id="booking" anchor so nav links still scroll to it
          html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*)\bid="booking"[^>]*>[\s\S]*?<\/\1>/gi,
            '<div id="booking"></div>');

          // Inject the real widget right after the now-empty #booking div
          // The widget's own <section id="booking"> will replace or be adjacent to the placeholder
          if (html.includes('id="booking"')) {
            html = html.replace('<div id="booking"></div>', bookingWidgetHtml);
            console.log("[Inngest] Booking widget replaced #booking placeholder");
          } else {
            html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
            console.log("[Inngest] Booking widget injected before </body>");
          }
        } catch (e) {
          console.error("[Inngest] Booking widget injection failed:", e);
        }
      }

      return html;
    });

    // ── STEP 8: Deploy to Vercel ──────────────────────────────────────────────
    // Uses stable project name so the preview URL is always predictable:
    //   wg-ironcorefitness.vercel.app (not a random hash URL)
    const previewUrl = await step.run("step8-deploy", async () => {
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: vercelProjectName,
          teamId: process.env.VERCEL_TEAM_ID || undefined,
          files: [{ file: "index.html", data: finalHtml, encoding: "utf-8" }],
          projectSettings: { framework: null, outputDirectory: "./" },
        }),
      });
      if (!deployRes.ok) {
        const errText = await deployRes.text();
        console.error("[Inngest] Deploy failed:", errText);
        return "";
      }
      const deployData = await deployRes.json();
      // The deployment URL is unique per-deploy, but the project alias is stable.
      // Vercel auto-aliases the latest deploy to <project-name>.vercel.app
      const stableUrl = `https://${vercelProjectName}.vercel.app`;
      console.log(`[Inngest] Deploy URL: https://${deployData.url} → Stable: ${stableUrl}`);
      return stableUrl;
    });

    console.log(`[Inngest] STEP 8 DONE: ${previewUrl}`);

    // ── STEP 9: Save to Redis ─────────────────────────────────────────────────
    await step.run("step9-save", async () => {
      await redis.set(`job:${jobId}`, {
        ...job,
        html: finalHtml,
        title: spec.projectTitle,
        fileName,
        domainSlug,
        vercelProjectName,
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
      const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au";
      const secret = encodeURIComponent(process.env.PROCESS_SECRET || "");
      const processUrl = `${base}/api/fix?id=${jobId}&secret=${secret}`;
      const unlockUrl = `${base}/api/payment/unlock?jobId=${jobId}&secret=${secret}`;
      const releaseUrl = `${base}/api/unlock/release?jobId=${jobId}&secret=${secret}`;
      const unlockBookingUrl = `${base}/api/unlock/booking?jobId=${jobId}&secret=${secret}`;
      const adminUrl = `${base}/admin?secret=${secret}`;
      const cssContent = extractCSS(finalHtml);

      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `✅ Build Complete — ${userInput.businessName}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:32px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#00c896,#0099ff);padding:24px 32px;">
    <h1 style="margin:0;color:#000;font-size:22px;font-weight:800;">✅ Build Complete</h1>
    <p style="margin:4px 0 0;color:rgba(0,0,0,0.7);font-size:14px;">${userInput.businessName} — ${spec.projectTitle}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Client</span>
        <p style="color:#e2e8f0;margin:2px 0 0;font-size:15px;font-weight:600;">${userInput.name || "—"} &lt;${clientEmail}&gt;</p>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Business</span>
        <p style="color:#e2e8f0;margin:2px 0 0;font-size:15px;font-weight:600;">${userInput.businessName}</p>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Industry · Phone</span>
        <p style="color:#e2e8f0;margin:2px 0 0;font-size:14px;">${userInput.industry} · ${clientPhone}</p>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Pages</span>
        <p style="color:#e2e8f0;margin:2px 0 0;font-size:14px;">${pageList}</p>
      </td></tr>
      <tr><td style="padding:12px 16px;">
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Features</span>
        <p style="color:#e2e8f0;margin:2px 0 0;font-size:14px;">${features.join(", ") || "Contact form"}</p>
      </td></tr>
    </table>
    ${previewUrl ? `<p style="margin:0 0 20px;"><a href="${previewUrl}" style="color:#00c896;font-size:15px;font-weight:600;">🌐 View Live Preview →</a></p>` : ""}
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${releaseUrl}" style="background:#00c896;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📤 Release to Client</a></td>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${processUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔧 Fix This Site</a></td>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${unlockUrl}" style="background:#8b5cf6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔓 Unlock Payment</a></td>
      ${hasBookingFeature ? `<td style="padding-right:8px;padding-bottom:8px;"><a href="${unlockBookingUrl}" style="background:#f59e0b;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📅 Unlock Booking</a></td>` : ""}
    </tr></table>
    <p style="margin:16px 0 0;"><a href="${adminUrl}" style="color:#475569;font-size:12px;">📊 Admin Dashboard</a></p>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="color:#334155;font-size:12px;margin:0;">3 files attached: final HTML, raw Stitch HTML (for comparison), and CSS stylesheet.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
        attachments: [
          { filename: `${fileName}-FINAL.html`, content: Buffer.from(finalHtml).toString("base64") },
          { filename: `${fileName}-STITCH-RAW.html`, content: Buffer.from(stitchHtml).toString("base64") },
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

    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au";
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
