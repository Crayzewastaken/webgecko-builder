// app/api/inngest/route.ts
export const maxDuration = 800;

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import {
  extractJson,
  safeFileName,
  extractCSS,
  checkAndFixLinks,
  fixNavigateToTargets,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { createSuperSaasSchedule } from "@/lib/supersaas";
import { createClientShopCatalogue } from "@/lib/square";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability, getAnalyticsCount, getBookingsForJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { createTawktoProperty } from "@/lib/tawkto";
import { subscribeToNewsletter } from "@/lib/beehiiv";
import { generateSiteBlueprint } from "@/lib/gemini";
import { auditAndFixSite } from "@/lib/auditor";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

// ─── Build Website ─────────────────────────────────────────────────────────────

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
      const j = await getJob(jobId);
      if (!j) throw new Error("Job not found: " + jobId);
      if (j.status === "building") throw new Error("Already building");
      // Allow rebuild of completed jobs — reset status to building
      await saveJob(jobId, { ...j, status: "building" });
      return j;
    });

    const {
      userInput, logoUrl, heroUrl,
      photoUrls = [], productsWithPhotos = [],
      hasBooking, clientSlug,
    } = job;

    const clientEmail = userInput?.email || "";
    const clientPhone = userInput?.phone || "";
    const fileName = job.fileName || safeFileName(userInput.businessName);
    const features: string[] = Array.isArray(userInput.features) ? userInput.features : [];

    const rawDomain: string = (userInput.domain || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const domainSlug: string = rawDomain
      ? rawDomain.replace(/\.(com\.au|net\.au|org\.au|com|net|org|io|au)$/i, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
      : fileName.slice(0, 40);
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

    // ── STEP 0: Brain 1 — Create SuperSaas schedule BEFORE Stitch so the booking
    // URL is embedded natively in the HTML by Stitch rather than injected after. ──
    const bookingUrl = await step.run("step0-supersaas", async () => {
      // Use client-provided URL if given — validate it looks like a real URL
      const existing = (userInput.existingBookingUrl || "").trim();
      if (existing) {
        // Must start with http(s):// to be a valid embeddable URL
        const isValidUrl = /^https?:\/\/.{4,}/.test(existing);
        if (isValidUrl) {
          console.log(`[Step0] Using client-provided booking URL: ${existing}`);
          return existing;
        } else {
          console.warn(`[Step0] Client-provided booking URL "${existing}" is not a valid URL — creating SuperSaas schedule instead`);
        }
      }
      if (!hasBookingFeature) return "";
      console.log("[Step0] Creating SuperSaas schedule before Stitch");
      const schedule = await createSuperSaasSchedule({
        businessName: userInput.businessName,
        clientEmail,
        timezone: "Australia/Brisbane",
        bookingServices: userInput.bookingServices || "",
      });
      if (schedule) {
        // Save schedule + sub-user credentials so the welcome email can include them
        await saveJob(jobId, {
          ...job,
          supersaasUrl: schedule.embedUrl,
          supersaasId: schedule.id,
          metadata: {
            ...(job.userInput || {}),
            supersaasSubEmail: schedule.subUserEmail,
            supersaasSubPassword: schedule.subUserPassword,
          },
        });
        if (schedule.subUserEmail) {
          console.log(`[Step0] SuperSaas sub-user created: ${schedule.subUserEmail} (password saved to job metadata)`);
        }
        console.log(`[Step0] SuperSaas schedule ready: ${schedule.embedUrl}`);
        return schedule.embedUrl;
      }
      console.warn("[Step0] SuperSaas creation failed — will use placeholder booking section");
      return "";
    });

    // ── STEP 1: Claude Haiku — Site Blueprint (Brain 1: Architect) ──────────
    const spec = await step.run("step1-blueprint", async () => {
      const blueprint = await generateSiteBlueprint({
        businessName: userInput.businessName,
        industry: userInput.industry,
        targetAudience: userInput.targetAudience || "general public",
        usp: userInput.usp || "quality service",
        goal: userInput.goal,
        style: userInput.style || "modern premium",
        colorPrefs: userInput.colorPrefs || "professional palette",
        references: userInput.references || "none",
        features,
        clientEmail,
        clientPhone,
        businessAddress: userInput.businessAddress || "",
        facebookPage: userInput.facebookPage || "",
        additionalNotes: userInput.additionalNotes || "none",
        pages: Array.isArray(userInput.pages) && userInput.pages.length > 0 ? userInput.pages : ["Home"],
        isMultiPage,
        hasBooking: hasBookingFeature,
        bookingUrl: bookingUrl || undefined,
        pricingSection,
        imageSection,
        productsWithPhotos,
      });
      return blueprint;
    });

    console.log(`[Inngest] STEP 1 DONE (Blueprint): ${spec.projectTitle} — palette: ${spec.palette?.primary}`);


    // ── STEP 2: Create Stitch project ─────────────────────────────────────────
    const projectId = await step.run("step2-stitch-create", async () => {
      console.log(`[Inngest] STEP 2 START: creating Stitch project "${spec.projectTitle}"`);
      const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
      console.log(`[Inngest] STEP 2: Stitch response keys=${Object.keys(project||{}).join(",")}`);
      const pid = project?.name?.split("/")[1];
      if (!pid) throw new Error("Stitch: no projectId returned. Response: " + JSON.stringify(project)?.slice(0, 200));
      console.log(`[Inngest] STEP 2 DONE: projectId=${pid}`);
      return pid;
    });

    // ── STEP 3: Stitch generate ─────────────────────────────────────────────
    // IMPORTANT: Stitch SDK says "DO NOT RETRY" — generation can take minutes and
    // retrying causes duplicate charges + broken state. One attempt only.
    // Inngest's own step-level retry handles transient failures automatically.
    const downloadUrl = await step.run("step3-stitch-generate", async () => {
      console.log(`[Inngest] STEP 3: Stitch generate (prompt: ${spec.stitchPrompt?.length} chars)`);
      const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
        projectId,
        prompt: spec.stitchPrompt,
      });

      const resultKeys = Object.keys(stitchResult || {}).join(",");
      console.log(`[Inngest] STEP 3 result: keys=${resultKeys}, code=${stitchResult?.code}`);

      // Log outputComponents for debugging — Stitch sometimes returns text/suggestions
      if (stitchResult?.outputComponents) {
        const oc = stitchResult.outputComponents;
        console.log(`[Inngest] STEP 3 outputComponents count=${oc.length}, types=${oc.map((x: any) => x.type || (x.design ? "design" : x.text ? "text" : "unknown")).join(",")}`);
        const textItems = oc.filter((x: any) => x.text);
        if (textItems.length) console.log(`[Inngest] STEP 3 Stitch text response: ${textItems.map((x: any) => x.text).join(" | ").slice(0, 300)}`);
      }

      // Hard error from Stitch
      if (stitchResult?.code === "UNKNOWN_ERROR") {
        throw new Error(`Stitch service error: ${stitchResult?.message || "UNKNOWN_ERROR"}`);
      }

      // Try primary path: outputComponents[].design.screens[].htmlCode.downloadUrl
      const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
      let url = screens[0]?.htmlCode?.downloadUrl as string | undefined;

      // Fallback: if Stitch returned a sessionId but no screens yet, poll get_screen once
      if (!url && stitchResult?.sessionId) {
        console.log(`[Inngest] STEP 3: no downloadUrl in result, trying get_screen with sessionId=${stitchResult.sessionId}`);
        await new Promise(resolve => setTimeout(resolve, 5_000));
        const screenResult: any = await stitchClient.callTool("get_screen", {
          projectId,
          sessionId: stitchResult.sessionId,
        }).catch((e: any) => { console.error("[Inngest] STEP 3 get_screen failed:", e.message); return null; });
        if (screenResult) {
          console.log(`[Inngest] STEP 3 get_screen result keys=${Object.keys(screenResult||{}).join(",")}`);
          const fallbackScreens = screenResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
          url = fallbackScreens[0]?.htmlCode?.downloadUrl;
        }
      }

      if (!url) {
        throw new Error(`Stitch: no downloadUrl in response. keys=${resultKeys}`);
      }

      const preCheck = await fetch(url).then(r => r.text()).catch(() => "");
      if (preCheck.length < 5000) throw new Error(`Stitch HTML too short (${preCheck.length} chars)`);
      if (/<h1>\s*HOME PAGE\s*<\/h1>/i.test(preCheck)) throw new Error(`Stitch returned skeleton`);
      // Count CSS in <style> blocks — Stitch often puts most styles inline so threshold is low
      const styleLen = (preCheck.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("").length;
      // Also count inline style attributes as a secondary signal
      const inlineStyleCount = (preCheck.match(/\bstyle=/gi) || []).length;
      if (styleLen < 100 && inlineStyleCount < 20) {
        throw new Error(`Stitch HTML has no CSS (styleLen=${styleLen}, inlineStyles=${inlineStyleCount})`);
      }

      console.log(`[Inngest] STEP 3 DONE: downloadUrl obtained, HTML ${preCheck.length} chars, styleLen=${styleLen}, inlineStyles=${inlineStyleCount}`);
      return url;
    });

    // ── STEP 4: Fetch HTML ────────────────────────────────────────────────────
    const stitchHtml = await step.run("step4-fetch-html", async () => {
      const html = await fetch(downloadUrl).then(r => r.text());
      if (!html || html.length < 5000) throw new Error(`Stitch HTML too short (${html?.length ?? 0} chars)`);
      const skeletonPatterns = [/<h1>\s*(HOME PAGE|ABOUT PAGE|SERVICES PAGE|CONTACT PAGE|PAGE CONTENT)\s*<\/h1>/i, /const BOOKING_URL = "https:\/\/cal\.com\/your-link"/i];
      for (const pattern of skeletonPatterns) {
        if (pattern.test(html)) throw new Error("Stitch returned a skeleton placeholder");
      }
      const styleContent = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join("");
      const inlineStyles = (html.match(/\bstyle=/gi) || []).length;
      if (styleContent.length < 100 && inlineStyles < 20) throw new Error(`Stitch HTML has no CSS (styleLen=${styleContent.length}, inline=${inlineStyles})`);
      return html;
    });

    // ── STEP 4b: Claude rewrites Stitch HTML — preserves visual style, guarantees structure ──
    // Stitch gives us the visual design. Claude rewrites it as clean, fully-functional HTML
    // with all required structural elements guaranteed (ids, mobile nav, booking iframe, etc.)
    const rebuiltHtml = await step.run("step4b-claude-rebuild", async () => {
      // Extract ALL CSS blocks (some Stitch outputs have multiple <style> tags)
      const allCss = (stitchHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
        .map((s: string) => s.replace(/<\/?style[^>]*>/gi, "")).join("\n").slice(0, 8000);
      const css = allCss;

      // Pass the FULL body — not just a snippet — so Claude sees all content
      // Split into two halves if too large so we capture both top and bottom sections
      const bodyMatch = stitchHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const fullBody = bodyMatch ? bodyMatch[1] : stitchHtml;
      const bodySnippet = fullBody.length <= 16000
        ? fullBody
        : fullBody.slice(0, 8000) + "\n<!-- ...middle truncated... -->\n" + fullBody.slice(-4000);

      const bookingBlock = hasBookingFeature && bookingUrl
        ? `<section id="booking" style="padding:80px 24px;background:#0a0f1a;scroll-margin-top:80px;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin:0 0 8px;">Book an Appointment</h2>
    <p style="color:#94a3b8;margin:0 0 32px;">Schedule your appointment with ${userInput.businessName} online.</p>
    <div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);">
      <iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" scrolling="auto" style="display:block;background:#fff;" loading="lazy"></iframe>
    </div>
  </div>
</section>`
        : "";

      // MULTI-PAGE: Only skip Claude rebuild if Stitch actually gave us a valid multi-page structure.
      // Stitch sometimes generates page-section CSS but only one page with no navigateTo calls —
      // in that case we must run Claude rebuild to get the full site structure.
      const stitchPageSections = (stitchHtml.match(/class="[^"]*page-section[^"]*"/g) || []).length;
      const stitchNavCalls = (stitchHtml.match(/navigateTo\s*\(/g) || []).length;
      const stitchIsValidMultiPage = isMultiPage && stitchPageSections >= 2 && stitchNavCalls >= 2;

      if (stitchIsValidMultiPage) {
        console.log("[Step4b] Multi-page site with valid Stitch structure (" + stitchPageSections + " pages, " + stitchNavCalls + " nav calls) — skipping Claude rebuild");
        return stitchHtml;
      }
      if (isMultiPage) {
        console.log("[Step4b] Multi-page requested but Stitch gave incomplete structure (" + stitchPageSections + " page-sections, " + stitchNavCalls + " nav calls) — running Claude rebuild");
      }

      // For multi-page sites where Stitch gave incomplete output, Claude rebuilds as multi-page
      const multiPageNote = isMultiPage
        ? `This is a MULTI-PAGE site with pages: ${pageList}. Each page must be a <div class="page-section" id="PAGENAME" data-page="PAGENAME"> element. First page has no extra style (visible), all others have style="display:none". Nav links use onclick="navigateTo('PAGENAME')". Include a navigateTo(id) JS function that removes .active from all .page-section divs and adds it to the target, and a toggleDrawer() for mobile nav.`
        : `This is a SINGLE-PAGE site. Nav links use onclick="document.getElementById('SECTIONID')?.scrollIntoView({behavior:'smooth'})".`;

      const prompt = `You are a senior front-end developer. I have a Stitch-generated website design below. Your job is to rewrite it as a complete, production-ready HTML file that EXACTLY preserves the visual design (colors, fonts, layout, imagery style) but guarantees all structural and functional requirements.

BUSINESS: ${userInput.businessName}
INDUSTRY: ${userInput.industry}
EMAIL: ${clientEmail} | PHONE: ${clientPhone}${userInput.businessAddress ? " | ADDRESS: " + userInput.businessAddress : ""}
${multiPageNote}

STITCH CSS (preserve these exact styles):
${css}

STITCH BODY (use this as your visual reference):
${bodySnippet}

ABSOLUTE REQUIREMENTS — every single one must be present in your output:
1. Sticky header with logo/business name + desktop nav links + hamburger button (id="hamburger") for mobile
2. <div id="mobile-menu" style="display:none;position:fixed;top:0;right:0;width:80%;max-width:300px;height:100vh;z-index:9999;background:#fff;"> — mobile drawer with all nav links + close button
${isMultiPage ? `3. MULTI-PAGE STRUCTURE: Each page is a <div class="page-section" id="PAGENAME" data-page="PAGENAME">. Pages: ${pageList.split(", ").map((p: string, i: number) => p.toLowerCase()).join(", ")}. First page has class="page-section active", all others class="page-section". CSS must include: .page-section{display:none} .page-section.active{display:block}
4. navigateTo(id) JS function: removes .active from all .page-section elements, adds .active to getElementById(id), scrolls to top
5. toggleDrawer() JS function for hamburger
6. Each page must have full rich content — hero, services, about info, testimonials, FAQ, contact form as appropriate per page
7. <section id="contact"> inside the Contact page with name/email/phone/message form. Real email: ${clientEmail}, phone: ${clientPhone}
8. <footer> — copyright © ${new Date().getFullYear()} ${userInput.businessName}
${hasBookingFeature && bookingUrl ? "9. Insert this EXACT booking section inside the Booking page (do not modify the iframe src):\n" + bookingBlock : hasBookingFeature ? "9. Booking page with prominent call-to-action to phone " + clientPhone : ""}` : `3. <section id="hero"> — full-viewport hero with headline, subheadline, CTA button
4. <section id="services"> — services grid with 4-6 cards
5. <section id="testimonials"> — 3+ Australian client names, 5-star ratings
6. <section id="faq"> — 6+ Q&A accordion pairs relevant to ${userInput.industry}
7. <section id="contact"> — form with name/email/phone/message fields. Real email: ${clientEmail}, phone: ${clientPhone}
8. <footer> — copyright © ${new Date().getFullYear()} ${userInput.businessName}
${hasBookingFeature && bookingUrl ? "9. Insert this EXACT booking section as-is (do not modify the iframe src):\n" + bookingBlock : hasBookingFeature ? "9. <section id=\"booking\"> with a prominent Book Now CTA" : ""}`}

RULES:
- Return ONLY the complete HTML starting with <!DOCTYPE html> — no explanation, no markdown
- Preserve the exact color palette, fonts, and visual style from the Stitch CSS
- Use the real business name, email, phone throughout — no placeholders
- All images: use unsplash.com or placehold.co URLs if no real images provided
- Mobile-first, responsive using the same Tailwind/CSS classes from the Stitch output
- The hamburger button MUST open the mobile-menu div (add inline onclick or wire via script)`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",  // Haiku: ~20x cheaper than Sonnet, reliable for HTML
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const start = text.indexOf("<!DOCTYPE");
      const extracted = start !== -1 ? text.slice(start) : text;

      // Validate Claude's output — check it has the key structural requirements
      const requiredIds = ['id="hamburger"', 'id="mobile-menu"', 'id="contact"'];
      const missingIds = requiredIds.filter(id => !extracted.includes(id));
      const isTooShort = extracted.length < 8000 || !extracted.includes("<html");

      if (isTooShort) {
        console.error("[Step4b] FALLBACK: Claude output too short/invalid (" + extracted.length + " chars) — using Stitch HTML");
        // Log to Resend so you know when this happens
        resend.emails.send({
          from: "WebGecko Pipeline <hello@webgecko.au>",
          to: "crayzewastaken@gmail.com",
          subject: "⚠️ Step4b Fallback — " + userInput.businessName,
          html: "<p>Claude rebuild failed for <strong>" + userInput.businessName + "</strong> (job: " + jobId + "). Fell back to raw Stitch HTML. Output was " + extracted.length + " chars.</p>",
        }).catch(() => {});
        return stitchHtml;
      }

      if (missingIds.length > 0) {
        console.warn("[Step4b] Claude output missing: " + missingIds.join(", ") + " — pipeline will patch these downstream");
      }

      console.log("[Step4b] Claude rebuilt HTML: " + extracted.length + " chars (Stitch was " + stitchHtml.length + " chars). Missing ids: " + (missingIds.join(",") || "none"));
      return extracted;
    });

    // ── STEP 5: Code-only fix pass ────────────────────────────────────────────
    const fixedHtml = await step.run("step5-code-fix", async () => {
      let html = rebuiltHtml;  // use Claude's rebuilt HTML instead of raw Stitch
      const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

      if (userInput.businessName) {
        html = html.replace(/<title>[^<]*<\/title>/i, `<title>${userInput.businessName}</title>`);
      }

      const clientDomain = clientEmail.split("@")[1] || "";
      const businessSlugFix = (userInput.businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      html = html.replace(/\b[\w.+-]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample|placeholder|site|gym|studio|salon|clinic|law|dental|realty|auto|cafe|restaurant|johnsgymsydney|johnsrestaurant|acmeconstruction|smithplumbing|greenthumb|brightsmile|eliteperformance|performancegym|purestrength|ironcore|elitefit|fitnesspro|peakperformance|urbanfit|alphaperformance)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
      if (clientDomain && businessSlugFix) {
        html = html.replace(/\b(info|hello|contact|admin|support|enquiries|enquiry|mail|office|reception|noreply|no-reply)@([\w-]+)\.(com|com\.au|au|net|org)\b/gi, (m: string, _prefix: string, domain: string) => {
          if (m === clientEmail) return m;
          if (m.includes("webgecko")) return m;
          if (clientDomain && m.toLowerCase().endsWith(clientDomain.toLowerCase())) return m;
          const domainStripped = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (domainStripped.includes(businessSlugFix.slice(0, 6)) || businessSlugFix.includes(domainStripped.slice(0, 6))) return clientEmail;
          return m;
        });
      }
      const clientPhoneDigits = clientPhone.replace(/\D/g, "");
      html = html.replace(/\b(0[0-9]{3}\s?[0-9]{3}\s?[0-9]{3,4})\b/g, (m: string) => {
        const digits = m.replace(/\D/g, "");
        if (digits === clientPhoneDigits) return m;
        if (/0{4,}/.test(digits) || /(\d)\1{4,}/.test(digits)) return clientPhone;
        return m;
      });
      html = html.replace(/\(\d{2}\)\s?\d{4}\s?\d{4}/g, clientPhone);
      html = html.replace(/\+61\s?[2-9]\s?\d{4}\s?\d{4}/g, clientPhone);
      const businessAddress = userInput.businessAddress || "";
      if (businessAddress) {
        html = html.replace(/\b123\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Place|Pl|Court|Ct)[,\s]+(?:Sydney|Melbourne|Brisbane|Perth|Adelaide|Gold Coast|Canberra|Darwin|Hobart)[,\s]+(?:NSW|VIC|QLD|WA|SA|ACT|NT|TAS)\s+\d{4}\b/gi, businessAddress);
        html = html.replace(/MAP PLACEHOLDER[:\s]*[A-Z\s]+/gi, businessAddress);
      }

      const ctaKeywords = ['Book Now','Book a Session','Get Started','Join Now','Sign Up','Free Trial','Book Free','Reserve','Enquire Now','Get a Quote','Start Today','Book Today','Schedule Now','Try Free','Get Free Quote','Book Consultation'];
      html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
        const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
        if (isBooking && !attrs.includes('navigateTo') && !attrs.includes('onclick')) {
          return `<a${attrs} onclick="event.preventDefault();var el=document.getElementById('${bookingNavTarget}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${bookingNavTarget}');}">${inner}</a>`;
        }
        return match;
      });

      if (businessAddress) {
        // Use Embed API with key if available, otherwise fall back to the free maps?q= iframe (no key needed)
        const mapsEmbed = process.env.GOOGLE_MAPS_API_KEY
          ? `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`
          : `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(businessAddress)}&output=embed"></iframe></div>`;
        if (!html.includes('maps.google') && !html.includes('maps.embed') && !html.includes('google.com/maps')) {
          let mapInjected = false;
          const beforeMapLen = html.length;
          html = html.replace(/<div[^>]*>\s*MAP PLACEHOLDER[^<]*<\/div>/gi, mapsEmbed);
          if (html.length !== beforeMapLen) mapInjected = true;
          if (!mapInjected) {
            html = html.replace(/<div([^>]*(?:id|class)="[^"]*(?:map|location|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/div>/gi, (match: string, attrs: string) => {
              if (match.includes('iframe')) return match;
              mapInjected = true;
              return `<div${attrs}>${mapsEmbed}</div>`;
            });
          }
          if (!mapInjected) {
            // Try id="contact" section (auditor ensures this exists)
            html = html.replace(/(<(?:section|div)[^>]*id="contact"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i, (_match: string, open: string, body: string, close: string) => {
              if (_match.includes('iframe')) return _match;
              mapInjected = true;
              const lastDiv = body.lastIndexOf('</div>');
              if (lastDiv !== -1) return open + body.slice(0, lastDiv) + mapsEmbed + body.slice(lastDiv) + close;
              return open + body + mapsEmbed + close;
            });
          }
          if (!mapInjected) {
            // Last resort: inject map block before </body>
            html = html.replace("</body>", `<div style="padding:40px 24px;background:#0a0f1a;">${mapsEmbed}</div>\n</body>`);
          }
        }
      }

      // Strip Stitch-generated scripts that define navigateTo or page-switching logic —
      // EXCEPTION: for multi-page sites, Stitch's navigateTo is the correct implementation
      // (it toggles .active class which matches Stitch's CSS). Don't strip it.
      if (!isMultiPage) {
        html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (m: string, body: string) => {
          const definesNavigateTo = /function\s+navigateTo/.test(body) || /window\.navigateTo\s*=/.test(body) || /var\s+navigateTo\s*=/.test(body);
          const definesPageSwitch = /function\s+showPage/.test(body) || /function\s+switchPage/.test(body) || /\.page-section['"\s]*[,{]/.test(body);
          if (definesNavigateTo || definesPageSwitch) {
            console.log("[Step5] Stripped conflicting Stitch script (" + body.length + " chars, navigateTo=" + definesNavigateTo + " pageSwitch=" + definesPageSwitch + ")");
            return "";
          }
          return m;
        });
      } else {
        console.log("[Step5] Multi-page: keeping Stitch navigateTo script (uses .active class toggle)");
      }

      // Replace Stitch's showPage('pageid') calls with our navigateTo('pageid') —
      // Stitch generates showPage() for all nav links but we strip its showPage definition above,
      // which leaves nav clicks doing nothing. This converts them to our injected navigateTo().
      if (isMultiPage) {
        const showPageCount = (html.match(/showPage\s*\(/g) || []).length;
        if (showPageCount > 0) {
          html = html.replace(/\bshowPage\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (_m: string, pageId: string) => {
            return `navigateTo('${pageId.toLowerCase()}')`;
          });
          console.log(`[Step5] Replaced ${showPageCount} showPage() calls with navigateTo()`);
        }
      }

      return html;
    });

    // ── STEP 6: Inject essentials + images (NO booking widget yet — auditor runs first) ─
    const injectedHtml = await step.run("step6-inject", async () => {
      const { html: checkedHtml } = checkAndFixLinks(fixedHtml, Array.isArray(userInput.pages) ? userInput.pages : []);
      const navFixedHtml = fixNavigateToTargets(checkedHtml);
      const ga4Id = job.ga4Id || userInput.ga4Id || "";
      // Create per-client Tawk.to property (Brain 1 — before Stitch)
      let tawktoPropertyId: string | undefined = undefined;
      if (features.includes("Live Chat")) {
        const existingPropId = process.env.TAWKTO_PROPERTY_ID;
        if (existingPropId) {
          tawktoPropertyId = existingPropId;
        } else {
          const propId = await createTawktoProperty(userInput.businessName);
          if (propId) {
            tawktoPropertyId = propId;
            await saveJob(jobId, { ...job, tawktoPropertyId: propId });
            console.log("[Step6] Tawk.to property created:", propId);
          }
        }
      }
      let html = injectEssentials(navFixedHtml, clientEmail, clientPhone, jobId, ga4Id, tawktoPropertyId);
      html = injectImages(html, logoUrl, heroUrl, photoUrls, productsWithPhotos);
      return html;
    });

    // ── STEP 6b: Auditor — ensures id="booking", id="contact", etc. all exist ──
    const auditedHtml = await step.run("step6b-audit", async () => {
      const result = await auditAndFixSite(injectedHtml, {
        businessName: userInput.businessName,
        clientEmail,
        clientPhone,
        businessAddress: userInput.businessAddress || "",
        hasBooking: hasBookingFeature,
        isMultiPage,
        pages: Array.isArray(userInput.pages) ? userInput.pages : ["Home"],
        features,
      });
      if (!result.passed) {
        console.log(`[Auditor] Fixed ${result.issues.length} issues:`, result.issues);
      }
      return result.fixedHtml;
    });

    // ── STEP 6c: Booking section — V2 fixed component (no injection) ─────────
    // The booking URL was created in step0 BEFORE Stitch, so Stitch already built
    // an id="booking" section with the iframe. This step guarantees the section is
    // correct by replacing whatever Stitch generated with our fixed component HTML.
    // No regex depth-walking. No guessing. Deterministic every time.
    const finalHtml = await step.run("step6c-booking", async () => {
      if (!hasBookingFeature) return auditedHtml;
      let html = auditedHtml;

      // Strip any stray booking iframes NOT in an id="booking" section — Stitch sometimes
      // generates a standalone iframe with supersaas.com/schedule/.../template before our
      // step creates the real schedule name. Remove these so we don't end up with two iframes.
      // We keep only the one inside id="booking" which we'll replace/inject below.
      // Strip ALL supersaas template iframes (self-closing or with closing tag)
      const templateIframeRe = /<iframe[^>]+src="https:\/\/www\.supersaas\.com\/schedule\/[^"]*\/template"[^>]*>(?:[\s\S]*?<\/iframe>)?/gi;
      const iframeCount = (html.match(templateIframeRe) || []).length;
      if (iframeCount > 0) {
        console.log(`[Step6c] Stripping ${iframeCount} stray template iframe(s)`);
        html = html.replace(templateIframeRe, "");
      }
      // Also strip any remaining supersaas template iframes (paranoid cleanup)
      html = html.replace(/<iframe[^>]+src="https:\/\/www\.supersaas\.com\/schedule\/[^"]*\/template"[^>]*>(?:[\s\S]*?<\/iframe>)?/gi, "");

      // Extract accent colour from CSS vars for theming the booking section
      let accentColor = spec.palette?.accent || "#10b981";
      const cssVarMatch = html.match(/--(?:primary|accent|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/);
      if (cssVarMatch?.[1]) accentColor = cssVarMatch[1];

      // Build the fixed booking component — parameterised only by URL, name, color
      const bookingComponent = bookingUrl
        ? [
            '<section id="booking" style="padding:80px 24px;background:#0a0f1a;scroll-margin-top:80px;">',
            '  <div style="max-width:900px;margin:0 auto;text-align:center;">',
            '    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin:0 0 8px;">Book an Appointment</h2>',
            `    <p style="color:#94a3b8;margin:0 0 32px;">Schedule your appointment with ${userInput.businessName} online.</p>`,
            '    <div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">',
            `      <iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" scrolling="auto" style="display:block;background:#fff;" title="Book an Appointment" loading="lazy"></iframe>`,
            '    </div>',
            `    <p style="color:#475569;font-size:12px;margin-top:16px;">Prefer to call? <a href="tel:${clientPhone}" style="color:${accentColor};">${clientPhone}</a></p>`,
            '  </div>',
            '</section>',
          ].join("\n")
        : [
            '<section id="booking" style="padding:80px 24px;background:#0a0f1a;text-align:center;scroll-margin-top:80px;">',
            '  <div style="max-width:640px;margin:0 auto;">',
            '    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin:0 0 16px;">Book an Appointment</h2>',
            `    <p style="color:#94a3b8;margin:0 0 32px;">Contact us to schedule your appointment with ${userInput.businessName}.</p>`,
            `    <a href="tel:${clientPhone}" style="display:inline-block;background:${accentColor};color:#fff;font-weight:700;font-size:1.1rem;padding:18px 40px;border-radius:10px;text-decoration:none;">Call ${clientPhone}</a>`,
            `    <p style="color:#475569;font-size:13px;margin-top:16px;">Or email us at <a href="mailto:${clientEmail}" style="color:${accentColor};">${clientEmail}</a></p>`,
            '  </div>',
            '</section>',
          ].join("\n");

      // Replace existing id="booking" element entirely using string walk
      // (simple open-tag find + depth counter — much simpler now that the component is fixed)
      // NOTE: must also match <header id="booking"> — Stitch sometimes uses header tags
      const bookingOpenMatch = html.match(/<(section|div|header|article|main)([^>]*\bid="booking"[^>]*)>/i);
      if (bookingOpenMatch) {
        const openTag = bookingOpenMatch[0];
        const tagName = bookingOpenMatch[1].toLowerCase();
        const startIdx = html.indexOf(openTag);
        let depth = 1;
        let pos = startIdx + openTag.length;
        const openRe = new RegExp(`<${tagName}[\\s>]`, "gi");
        const closeRe = new RegExp(`<\\/${tagName}>`, "gi");
        while (depth > 0 && pos < html.length) {
          openRe.lastIndex = pos;
          closeRe.lastIndex = pos;
          const nextOpen = openRe.exec(html);
          const nextClose = closeRe.exec(html);
          if (!nextClose) break;
          if (nextOpen && nextOpen.index < nextClose.index) {
            depth++;
            pos = nextOpen.index + nextOpen[0].length;
          } else {
            depth--;
            pos = nextClose.index + nextClose[0].length;
          }
        }
        html = html.slice(0, startIdx) + bookingComponent + html.slice(pos);
        console.log(`[Step6c] Booking component installed. iframe present: ${html.includes("supersaas.com") || html.includes(bookingUrl || "NOPE")}`);
      } else {
        // Stitch didn't generate a booking section — inject before </body>
        html = html.replace("</body>", bookingComponent + "\n</body>");
        console.log("[Step6c] Booking component injected before </body> (no id=booking in Stitch output)");
      }

      return html;
    });

    // ── STEP 7: Square shop ───────────────────────────────────────────────────
    const hasShopFeature = features.includes("Payments / Shop");
    const shopProducts: { name: string; price: string; photoUrl?: string }[] = productsWithPhotos.length > 0 ? productsWithPhotos : [];

    const finalHtmlWithShop = await step.run("step7-shop", async () => {
      if (!hasShopFeature || shopProducts.length === 0) return finalHtml;
      let html = finalHtml;
      try {
        const siteUrl = `https://${vercelProjectName}.vercel.app`;
        const catalogueItems = await createClientShopCatalogue({ jobId, businessName: userInput.businessName, products: shopProducts, redirectUrl: siteUrl });

        // Save to Supabase (in a simple JSON column on the job — no separate table needed)
        await supabase.from("jobs").update({ user_input: { ...userInput, shopCatalogue: catalogueItems } }).eq("id", jobId);

        catalogueItems.forEach((item: any, i: number) => {
          if (!item.paymentLinkUrl) return;
          const btnPattern = new RegExp(`<button([^>]*class="[^"]*wg-buy-btn[^"]*"[^>]*data-product-index="${i}"[^>]*)>[^<]*<\\/button>`, "gi");
          const anchorPattern = new RegExp(`<button([^>]*data-product-index="${i}"[^>]*class="[^"]*wg-buy-btn[^"]*"[^>]*)>[^<]*<\\/button>`, "gi");
          const replacement = `<a href="${item.paymentLinkUrl}" target="_blank" rel="noopener" class="wg-buy-btn" data-product-index="${i}" style="display:inline-block;text-decoration:none;">Buy Now</a>`;
          html = html.replace(btnPattern, replacement).replace(anchorPattern, replacement);
        });

        const squareBadge = `<div style="text-align:center;margin-top:16px;padding:8px;"><p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0;">Secure checkout powered by Square</p></div>`;
        html = html.replace(/(<section[^>]*(?:id|class)="[^"]*shop[^"]*"[^>]*>[\s\S]*?)(<\/section>)/gi, (_m: string, body: string, close: string) => body + squareBadge + close);
      } catch (e) {
        console.error("[Inngest] STEP 7: Shop catalogue failed:", e);
      }
      return html;
    });

    // ── STEP 8: Deploy to Vercel ──────────────────────────────────────────────
    const previewUrl = await step.run("step8-deploy", async () => {
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vercelProjectName,
          teamId: process.env.VERCEL_TEAM_ID || undefined,
          files: [{ file: "index.html", data: finalHtmlWithShop, encoding: "utf-8" }],
          projectSettings: { framework: null, outputDirectory: "./" },
        }),
      });
      if (!deployRes.ok) { console.error("[Inngest] Deploy failed:", await deployRes.text()); return ""; }
      return `https://${vercelProjectName}.vercel.app`;
    });

    // ── STEP 8b: Smoke test — fetch live URL and verify critical elements ─────
    // Non-blocking: failures recorded and surfaced in the email, never kill the build.
    type SmokeCheck = { label: string; pass: boolean; severity: "error" | "warn" };
    const smokeResults = await step.run("step8b-smoke", async () => {
      const checks: SmokeCheck[] = [];
      if (!previewUrl) return [{ label: "Deploy URL", pass: false, severity: "error" as const }];

      // Vercel cold-starts — retry up to 3x with backoff
      let liveHtml = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await new Promise(r => setTimeout(r, attempt * 2000));
          const res = await fetch(previewUrl, { headers: { "User-Agent": "WebGecko-SmokeTest/1.0" } });
          if (res.ok) { liveHtml = await res.text(); break; }
        } catch {}
        console.log("[Smoke] Attempt " + attempt + " failed for " + previewUrl);
      }

      if (!liveHtml) return [{ label: "Site reachable", pass: false, severity: "error" as const }];

      checks.push({ label: "Site reachable",        pass: true,                                                                   severity: "error" });
      checks.push({ label: "Has <html> tag",         pass: liveHtml.includes("<html"),                                            severity: "error" });
      checks.push({ label: "Substantial content",    pass: liveHtml.length > 5000,                                                severity: "error" });
      checks.push({ label: "No skeleton placeholder",pass: !/<h1>\s*(HOME PAGE|PAGE CONTENT)\s*<\/h1>/i.test(liveHtml),        severity: "error" });
      checks.push({ label: "Real email present",     pass: liveHtml.includes(clientEmail),                                        severity: "error" });
      checks.push({ label: "Has navigation",         pass: liveHtml.includes('id="hamburger"') || liveHtml.includes("<nav"),     severity: "error" });
      checks.push({ label: "Hero section",           pass: /id=["\']hero["\']/.test(liveHtml),                                  severity: "warn"  });
      checks.push({ label: "Contact section",        pass: /id=["\']contact["\']/.test(liveHtml),                               severity: "warn"  });
      checks.push({ label: "Testimonials section",   pass: /id=["\']testimonials["\']/.test(liveHtml),                          severity: "warn"  });
      checks.push({ label: "FAQ section",            pass: /id=["\']faq["\']/.test(liveHtml),                                   severity: "warn"  });
      checks.push({ label: "Footer copyright",       pass: liveHtml.includes("©") || liveHtml.includes("&copy;"),                 severity: "warn"  });
      if (hasBookingFeature) {
        checks.push({ label: "Booking section",      pass: /id=["\']booking["\']/.test(liveHtml),                               severity: "error" });
        const hasRealBookingIframe = (!!bookingUrl && liveHtml.includes(bookingUrl)) || (liveHtml.includes("supersaas.com") && !liveHtml.includes("/template"));
        checks.push({ label: "Booking iframe",       pass: hasRealBookingIframe, severity: "error" });
      }
      if (isMultiPage) {
        checks.push({ label: "Multi-page navigateTo", pass: liveHtml.includes("navigateTo"),                                      severity: "error" });
        checks.push({ label: "No stray showPage()",   pass: !liveHtml.includes("showPage("),                                      severity: "warn"  });
      }
      if (userInput.businessAddress) {
        checks.push({ label: "Google Maps embedded",  pass: liveHtml.includes("google.com/maps"),                                 severity: "warn"  });
      }

      const passed = checks.filter(c => c.pass).length;
      const errors = checks.filter(c => !c.pass && c.severity === "error");
      const warns  = checks.filter(c => !c.pass && c.severity === "warn");
      console.log("[Smoke] " + passed + "/" + checks.length + " passed | errors: " + errors.length + " | warns: " + warns.length);
      if (errors.length) console.error("[Smoke] ERRORS: " + errors.map((c: SmokeCheck) => c.label).join(", "));
      return checks;
    });

    // ── STEP 8c: Fail loop — re-audit and redeploy if smoke errors found ────────
    // Max 2 extra attempts. Each attempt: re-run auditor on finalHtmlWithShop,
    // patch what it finds, redeploy, re-smoke. Non-blocking if all retries fail.
    const MAX_FIX_ATTEMPTS = 2;
    let loopHtml = finalHtmlWithShop;
    let loopPreviewUrl = previewUrl;
    let loopSmokeResults = smokeResults;

    for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
      const hasErrors = loopSmokeResults.some((c: any) => !c.pass && c.severity === "error");
      if (!hasErrors) break;

      const errorLabels = loopSmokeResults.filter((c: any) => !c.pass && c.severity === "error").map((c: any) => c.label);
      console.log("[FailLoop] Attempt " + attempt + " — errors: " + errorLabels.join(", "));

      loopHtml = await step.run("step8c-fix-attempt-" + attempt, async () => {
        // Re-audit with current HTML to pick up any remaining issues
        const reAudit = await auditAndFixSite(loopHtml, {
          businessName: userInput.businessName,
          clientEmail,
          clientPhone,
          businessAddress: userInput.businessAddress || "",
          hasBooking: hasBookingFeature,
          isMultiPage,
          pages: Array.isArray(userInput.pages) ? userInput.pages : ["Home"],
          features,
        });
        let patched = reAudit.fixedHtml;

        // If booking iframe missing — re-apply the fixed booking component
        const hasRealIframe = (!!bookingUrl && patched.includes(bookingUrl)) || (patched.includes("supersaas.com") && !patched.includes("/template"));
        if (hasBookingFeature && !hasRealIframe) {
          const accentColor = spec.palette?.accent || "#10b981";
          const bookingComponent = bookingUrl
            ? ['<section id="booking" style="padding:80px 24px;background:#0a0f1a;scroll-margin-top:80px;">',
               '  <div style="max-width:900px;margin:0 auto;text-align:center;">',
               '    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin:0 0 8px;">Book an Appointment</h2>',
               '    <p style="color:#94a3b8;margin:0 0 32px;">Schedule your appointment with ' + userInput.businessName + ' online.</p>',
               '    <div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">',
               '      <iframe src="' + bookingUrl + '" width="100%" height="700" frameborder="0" scrolling="auto" style="display:block;background:#fff;" title="Book an Appointment" loading="lazy"></iframe>',
               '    </div>',
               '  </div>',
               '</section>'].join("\n")
            : '<section id="booking" style="padding:80px 24px;background:#0a0f1a;text-align:center;"><div style="max-width:640px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;">Book an Appointment</h2><a href="tel:' + clientPhone + '" style="display:inline-block;margin-top:24px;background:' + accentColor + ';color:#fff;font-weight:700;padding:16px 36px;border-radius:10px;text-decoration:none;font-size:1.1rem;">Call ' + clientPhone + '</a></div></section>';
          patched = patched.replace("</body>", bookingComponent + "\n</body>");
          console.log("[FailLoop] Re-injected booking component");
        }

        // If navigateTo missing on multi-page — re-inject via injectEssentials is too heavy;
        // just ensure the script tag is present
        if (isMultiPage && !patched.includes("navigateTo")) {
          patched = patched.replace("</body>", "<script>window.navigateTo=function(id){var dp=document.querySelectorAll('[data-page]');var ps=document.querySelectorAll('.page-section[id]');var pages=dp.length>1?dp:ps;if(pages.length>1){pages.forEach(function(p){p.style.display='none';p.classList.remove('active');});var t=document.querySelector('[data-page=\"'+id+'\"]') || document.getElementById(id);if(t){t.style.display='block';t.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}}else{var t=document.getElementById(id);if(t)t.scrollIntoView({behavior:'smooth'});}};\n</script>\n</body>");
          console.log("[FailLoop] Re-injected navigateTo");
        }

        return patched;
      });

      // Redeploy patched HTML
      loopPreviewUrl = await step.run("step8c-redeploy-" + attempt, async () => {
        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: "Bearer " + process.env.VERCEL_API_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: vercelProjectName,
            teamId: process.env.VERCEL_TEAM_ID || undefined,
            files: [{ file: "index.html", data: loopHtml, encoding: "utf-8" }],
            projectSettings: { framework: null, outputDirectory: "./" },
          }),
        });
        if (!deployRes.ok) { console.error("[FailLoop] Redeploy failed:", await deployRes.text()); return loopPreviewUrl; }
        console.log("[FailLoop] Redeployed attempt " + attempt);
        return "https://" + vercelProjectName + ".vercel.app";
      });

      // Re-smoke
      loopSmokeResults = await step.run("step8c-resmoke-" + attempt, async () => {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const res = await fetch(loopPreviewUrl, { headers: { "User-Agent": "WebGecko-SmokeTest/1.0" } });
          if (!res.ok) return [{ label: "Site reachable", pass: false, severity: "error" }];
          const liveHtml = await res.text();
          const checks: any[] = [];
          checks.push({ label: "Site reachable",         pass: true,                                                 severity: "error" });
          checks.push({ label: "Real email present",      pass: liveHtml.includes(clientEmail),                       severity: "error" });
          checks.push({ label: "Has navigation",          pass: liveHtml.includes('id="hamburger"') || liveHtml.includes("<nav"), severity: "error" });
          if (hasBookingFeature) {
            checks.push({ label: "Booking section",       pass: /id=["'"]booking["'"]/.test(liveHtml),              severity: "error" });
            const hasRealIframe2 = (!!bookingUrl && liveHtml.includes(bookingUrl)) || (liveHtml.includes("supersaas.com") && !liveHtml.includes("/template"));
          checks.push({ label: "Booking iframe",        pass: hasRealIframe2, severity: "error" });
          }
          if (isMultiPage) checks.push({ label: "navigateTo present", pass: liveHtml.includes("navigateTo"),          severity: "error" });
          console.log("[FailLoop] Re-smoke attempt " + attempt + ": " + checks.filter((c: any) => c.pass).length + "/" + checks.length + " passed");
          return checks;
        } catch (e) {
          return [{ label: "Site reachable", pass: false, severity: "error" }];
        }
      });
    }

    // Use loop's final HTML and URL for save/email
    const deployedHtml = loopHtml;
    const deployedUrl  = loopPreviewUrl;
    const finalSmokeResults = loopSmokeResults;

    // ── STEP 9: Save to Supabase ──────────────────────────────────────────────
    await step.run("step9-save", async () => {
      await saveJob(jobId, {
        ...job,
        html: deployedHtml,
        title: spec.projectTitle,
        fileName,
        domainSlug,
        vercelProjectName,
        status: "complete",
        previewUrl: deployedUrl,
        builtAt: new Date().toISOString(),
      });

      if (clientSlug) {
        const existingClient = await getClient(clientSlug);
        if (existingClient) {
          await saveClient(clientSlug, { ...existingClient, preview_url: deployedUrl });
        }
      }

      // Beehiiv newsletter subscription — subscribe client when Newsletter feature selected
      if (features.includes("Newsletter Signup") && clientEmail) {
        const subscribed = await subscribeToNewsletter({
          email: clientEmail,
          name: userInput.businessName,
          referringSite: deployedUrl || "webgecko.au",
        });
        console.log("[Step9] Beehiiv subscription for " + clientEmail + ": " + (subscribed ? "OK" : "skipped/failed"));
      }

      // Auto-create availability config if booking is enabled
      if (hasBookingFeature) {
        const existingAvail = await getAvailability(jobId);
        if (!existingAvail) {
          const slotDurationMap: Record<string, number> = {
            medical: 30, dental: 30, physio: 45, beauty: 45, hair: 45, massage: 60,
            legal: 60, accounting: 60, financial: 60, fitness: 60, gym: 60, personal: 60,
          };
          const industryLower = (userInput.industry || "").toLowerCase();
          const slotDuration = Object.entries(slotDurationMap).find(([k]) => industryLower.includes(k))?.[1] ?? 60;
          await saveAvailability(jobId, {
            businessName: userInput.businessName,
            clientEmail,
            timezone: "Australia/Brisbane",
            days: [1, 2, 3, 4, 5],
            startHour: 9, endHour: 17,
            slotDurationMinutes: slotDuration,
            bufferMinutes: 15, maxDaysAhead: 30,
            services: getServicesForIndustry(userInput.industry),
          });
        }
      }
    });

    // ── STEP 10: Email owner ──────────────────────────────────────────────────
    await step.run("step10-email", async () => {
      const base = "https://webgecko-builder.vercel.app";
      const secret = encodeURIComponent(process.env.PROCESS_SECRET || "");
      const releaseUrl = `${base}/api/unlock/release?jobId=${jobId}&secret=${secret}`;
      const fixUrl = `${base}/api/admin/fix-proxy?jobId=${jobId}&secret=${secret}`;
      const unlockBookingUrl = `${base}/api/unlock/booking?jobId=${jobId}&secret=${secret}`;
      const adminUrl = `${base}/admin?secret=${secret}`;
      const cssContent = extractCSS(deployedHtml);

      // Smoke test results table for email
      const smokeErrors  = finalSmokeResults.filter((c: any) => !c.pass && c.severity === "error");
      const smokeWarns   = finalSmokeResults.filter((c: any) => !c.pass && c.severity === "warn");
      const smokeAllPass = smokeErrors.length === 0;
      const smokeRowsHtml = finalSmokeResults.map((c: any) =>
        "<tr><td style=\"padding:6px 16px;font-size:12px;color:" + (c.pass ? "#00c896" : c.severity === "error" ? "#ef4444" : "#f59e0b") + ";\">" + (c.pass ? "✓" : c.severity === "error" ? "✗" : "⚠") + "</td>" +
        "<td style=\"padding:6px 16px;font-size:12px;color:" + (c.pass ? "#e2e8f0" : c.severity === "error" ? "#f87171" : "#fcd34d") + "\">" + c.label + "</td></tr>"
      ).join("");
      const smokeSummaryHtml = smokeResults.length > 0
        ? "<div style=\"margin-bottom:24px;\">" +
          "<p style=\"color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;\">Live Site Smoke Test — " + (smokeAllPass ? "ALL PASS" : smokeErrors.length + " ERROR(S)") + "</p>" +
          "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#080c14;border-radius:8px;\">" + smokeRowsHtml + "</table>" +
          "</div>"
        : "";

      const featureChecklist = [
        { label: "Hero section", check: deployedHtml.includes('id="hero') || deployedHtml.includes('viewport') },
        { label: "Sticky nav + hamburger", check: deployedHtml.includes('id="hamburger"') },
        { label: "Testimonials section", check: deployedHtml.includes('id="testimonials"') },
        { label: "FAQ accordion", check: deployedHtml.includes('id="faq"') },
        { label: "Contact form", check: deployedHtml.includes('id="contact"') },
        { label: "Real email injected", check: deployedHtml.includes(clientEmail) },
        { label: "Real phone injected", check: deployedHtml.includes(clientPhone.replace(/\s/g, "")) || deployedHtml.includes(clientPhone) },
        { label: "Google Maps embedded", check: deployedHtml.includes("google.com/maps") },
        { label: "Booking widget", check: hasBookingFeature && (deployedHtml.includes("supersaas.com") || (bookingUrl ? deployedHtml.includes(bookingUrl) : false) || deployedHtml.includes('id="booking"')) },
        { label: "Footer with copyright", check: deployedHtml.includes("©") || deployedHtml.includes("&copy;") },
      ].filter(f => {
        if (f.label === "Booking widget" && !hasBookingFeature) return false;
        if (f.label === "Google Maps embedded" && !userInput.businessAddress) return false;
        return true;
      });

      const checklistHtml = featureChecklist.map(f =>
        `<tr><td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:${f.check ? "#00c896" : "#ef4444"};">${f.check ? "✓" : "✗"}</td><td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:${f.check ? "#e2e8f0" : "#f87171"};">${f.label}</td></tr>`
      ).join("");

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
    ${deployedUrl ? `<p style="margin:0 0 20px;"><a href="${deployedUrl}" style="color:#00c896;font-size:15px;font-weight:600;">🌐 View Live Preview →</a></p>` : ""}
    ${smokeSummaryHtml}
    <div style="margin-bottom:24px;">
      <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Build Checklist (HTML)</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;border-radius:8px;">${checklistHtml}</table>
    </div>
    ${hasBookingFeature && job.metadata?.supersaasSubEmail ? `<div style="background:#0a1628;border:1px solid rgba(0,200,150,0.2);border-radius:8px;padding:16px 20px;margin-bottom:20px;"><p style="color:#00c896;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">📅 SuperSaas Sub-Account (client login)</p><p style="color:#94a3b8;font-size:13px;margin:0;">Login: <strong style="color:#e2e8f0;">${job.metadata.supersaasSubEmail}</strong> — Password: <strong style="color:#e2e8f0;">${job.metadata.supersaasSubPassword}</strong><br><span style="color:#475569;font-size:12px;">Client can log in at supersaas.com and manage only their own schedule</span></p></div>` : ""}
    ${hasBookingFeature ? `<div style="background:#1a0a0a;border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:#ef4444;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">⚠️ Manual Action Required — SuperSaas Schedule</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 12px;">The booking iframe is embedded but the SuperSaas schedule must be created manually (SuperSaas does not support programmatic schedule creation).</p>
      <ol style="color:#e2e8f0;font-size:13px;margin:0 0 12px;padding-left:20px;line-height:2;">
        <li>Go to <a href="https://www.supersaas.com/dashboard" style="color:#f87171;">supersaas.com/dashboard</a></li>
        <li>Click <strong>New Schedule</strong></li>
        <li>Name it exactly: <strong style="color:#fbbf24;font-family:monospace;">${fileName}</strong></li>
        <li>Configure hours, slot duration, notifications to <strong>${clientEmail}</strong></li>
        ${userInput.bookingServices ? `<li>Add a <strong>Drop-down list</strong> field named "Service" with options: <strong>${userInput.bookingServices}</strong></li>` : ""}
        <li>Save — the booking iframe on the site will automatically use this schedule</li>
        <li>Once done, click <a href="${base}/api/pipeline/run?jobId=${jobId}&secret=${secret}" style="color:#fbbf24;font-weight:700;">🔄 Rebuild Site</a> — the booking iframe will automatically use the new schedule</li>
      </ol>
      <p style="color:#475569;font-size:12px;margin:0;">Schedule URL will be: <span style="color:#94a3b8;font-family:monospace;">supersaas.com/schedule/webgecko/${fileName}</span></p>
    </div>` : ""}
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${releaseUrl}" style="background:#00c896;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📤 Release to Client</a></td>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${fixUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔧 Fix This Site</a></td>
      ${hasBookingFeature ? `<td style="padding-right:8px;padding-bottom:8px;"><a href="${unlockBookingUrl}" style="background:#f59e0b;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📅 Unlock Booking</a></td><td style="padding-right:8px;padding-bottom:8px;"><a href="${base}/api/pipeline/run?jobId=${jobId}&secret=${secret}" style="background:#fbbf24;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔄 Rebuild Site</a></td>` : ""}
    </tr></table>
    <p style="margin:16px 0 0;"><a href="${adminUrl}" style="color:#475569;font-size:12px;">📊 Admin Dashboard</a></p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
        attachments: [
          { filename: `${fileName}-FINAL.html`, content: Buffer.from(deployedHtml).toString("base64") },
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

    const month = now.toISOString().slice(0, 7);

    await step.run("send-monthly-reports", async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("job_id, business_name, email")
        .not("email", "is", null);
      if (!clients || clients.length === 0) return;

      for (const client of clients) {
        try {
          const jobId = client.job_id;
          if (!jobId) continue;
          const [monthViews, monthBookingClicks, allBookings] = await Promise.all([
            getAnalyticsCount(jobId, "page_view", "monthly", month),
            getAnalyticsCount(jobId, "booking_click", "monthly", month),
            getBookingsForJob(jobId),
          ]);
          const bookingCount = allBookings.filter((b: any) => b.status !== "cancelled").length;

          await resend.emails.send({
            from: "WebGecko <hello@webgecko.au>",
            to: client.email,
            subject: "Your Monthly Website Report - " + client.business_name,
            html: "<div style=\"font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;color:#e2e8f0;\"><h1 style=\"color:#10b981;\">Monthly Report — " + client.business_name + "</h1><p style=\"color:#94a3b8;\">" + month + "</p><div style=\"background:#0f1623;border-radius:12px;padding:24px;margin:24px 0;\"><p>Page Views: " + monthViews + "</p><p>Booking Clicks: " + monthBookingClicks + "</p><p>Total Bookings: " + bookingCount + "</p></div></div>",
          });
        } catch (e) {
          console.error("[Monthly] Failed for " + client.business_name + ":", e);
        }
      }
    });
  }
);

// ─── Auto-Release Scheduled Function ─────────────────────────────────────────
// Runs every 6 hours, checks for jobs with scheduledReleaseAt in the past,
// and auto-releases them to the client (sends welcome email + unlocks portal).

const autoRelease = inngest.createFunction(
  {
    id: "auto-release-sites",
    name: "Auto-Release Sites to Clients",
    triggers: [{ cron: "0 */6 * * *" }], // every 6 hours
  },
  async ({ step }: { step: any }) => {
    await step.run("check-scheduled-releases", async () => {
      // Get all jobs from Supabase and check metadata.scheduledReleaseAt
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, metadata, user_input, client_slug")
        .not("metadata->scheduledReleaseAt", "is", null)
        .eq("metadata->alreadyReleased", false as any)
        .is("preview_unlocked_at", null);

      if (!jobs || jobs.length === 0) {
        console.log("[AutoRelease] No pending releases");
        return;
      }

      const now = new Date();
      for (const job of jobs) {
        const releaseAt = job.metadata?.scheduledReleaseAt;
        if (!releaseAt) continue;
        if (new Date(releaseAt) > now) continue; // not time yet

        console.log("[AutoRelease] Releasing job", job.id, "scheduled for", releaseAt);
        try {
          const base = "https://webgecko-builder.vercel.app";
          const secret = encodeURIComponent(process.env.PROCESS_SECRET || "");
          const res = await fetch(`${base}/api/unlock/release?jobId=${job.id}&secret=${secret}`);
          if (res.ok) {
            // Mark as released so we don't re-release
            await supabase
              .from("jobs")
              .update({ metadata: { ...(job.metadata || {}), alreadyReleased: true, releasedAt: now.toISOString() } })
              .eq("id", job.id);
            console.log("[AutoRelease] Released job", job.id, "for", job.user_input?.businessName);
          } else {
            console.error("[AutoRelease] Release failed for", job.id, "→", res.status);
          }
        } catch (e) {
          console.error("[AutoRelease] Error releasing job", job.id, ":", e);
        }
      }
    });
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports, autoRelease],
});
