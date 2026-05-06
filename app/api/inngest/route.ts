// app/api/inngest/route.ts
export const maxDuration = 800;

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { stitchSdk } from "@/lib/stitch";
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
  normalizePageId,
  repairHtml,
  validateForDeploy,
  ensureMultiPageStructure,
} from "@/lib/pipeline-helpers";
import { createSuperSaasSchedule } from "@/lib/supersaas";
import { createClientShopCatalogue } from "@/lib/square";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability, getAnalyticsCount, getBookingsForJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { createTawktoProperty } from "@/lib/tawkto";
import { subscribeToNewsletter } from "@/lib/beehiiv";
import { provisionClientDomain } from "@/lib/synergy";
import { generateSiteBlueprint, requestGoogleIndexing } from "@/lib/blueprint";
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
  async ({ event, step }: { event: { data: { jobId: string; isRebuild?: boolean } }; step: any }) => {
    const { jobId, isRebuild = false } = event.data;

    // ── Load job ──────────────────────────────────────────────────────────────
    const job = await step.run("load-job", async () => {
      const j = await getJob(jobId);
      if (!j) throw new Error("Job not found: " + jobId);
      // Block concurrent builds, but allow rebuild/fullRebuild to override a stuck job
      if (j.status === "building" && !isRebuild) throw new Error("Already building");
      await saveJob(jobId, { ...j, status: "building" });
      return j;
    });

    // ── REBUILD MODE: skip Stitch + Claude generation, reuse saved HTML ────────
    // When triggered via /api/pipeline/run, isRebuild=true. Steps 0-4b are skipped
    // so the visual design stays consistent and we do not hit Stitch again.
    const savedHtmlForRebuild: string | null = (isRebuild && job.html && job.html.length > 5000)
      ? job.html : null;
    if (isRebuild) {
      console.log(savedHtmlForRebuild
        ? "[Rebuild] Using saved HTML (" + (job.html?.length ?? 0) + " chars) — skipping Stitch"
        : "[Rebuild] No saved HTML — running full pipeline");
    }


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
    const bookingUrl = (isRebuild && job.supersaasUrl)
      ? job.supersaasUrl
      : await step.run("step0-supersaas", async () => {
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
    const spec = savedHtmlForRebuild
      ? { projectTitle: job.title || "Website", stitchPrompt: "", palette: { primary: "#1a1a2e", accent: "#10b981", background: "#0a0f1a", surface: "#0f1623", text: "#e2e8f0" }, typography: { headingFont: "Inter", bodyFont: "Inter", heroSize: "72px" }, sections: [] as string[], tone: "", heroHeadline: "", heroSubheadline: "", ctaText: "", uniqueDesignIdea: "" }
      : await step.run("step1-blueprint", async () => {
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
    const projectId = savedHtmlForRebuild ? "rebuild-skipped" : await step.run("step2-stitch-create", async () => {
      console.log(`[Inngest] STEP 2 START: creating Stitch project "${spec.projectTitle}"`);
      const project = await stitchSdk.createProject(spec.projectTitle);
      const pid = project.projectId;
      if (!pid) throw new Error("Stitch: no projectId returned from createProject");
      console.log(`[Inngest] STEP 2 DONE: projectId=${pid}`);
      return pid;
    }) as string;


    // ── STEP 3: Stitch generate + fetch HTML ────────────────────────────────────
    // Fetch the HTML immediately after getting the URL — Stitch signed URLs are
    // short-lived, so we must not store the URL and re-fetch later.
    const stitchHtml = savedHtmlForRebuild ? savedHtmlForRebuild : await step.run("step3-stitch-generate", async () => {
      console.log(`[Inngest] STEP 3: Stitch generate (prompt: ${spec.stitchPrompt?.length} chars)`);

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      // Stitch generate can fail with "Incomplete API response" transiently — retry up to 3x
      let screen: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const project = stitchSdk.project(projectId);
          screen = await project.generate(spec.stitchPrompt, "DESKTOP");
          console.log(`[Inngest] STEP 3: screen id=${screen.screenId} (attempt ${attempt})`);
          break;
        } catch (e: any) {
          const msg = e?.message || String(e);
          console.warn(`[Inngest] STEP 3: generate attempt ${attempt} failed: ${msg}`);
          if (attempt === 3) throw e;
          await sleep(5000 * attempt);
        }
      }

      // getHtml() returns empty when htmlCode isn't cached on the generation response.
      // Retry with generous backoff — Stitch can take 30-60s to commit the screen.
      let url = await screen.getHtml();
      if (!url) {
        // Waits: 8s, 15s, 20s, 25s, 30s = ~98s total
        const waits = [8000, 15000, 20000, 25000, 30000];
        for (let i = 0; i < waits.length; i++) {
          await sleep(waits[i]);
          console.log(`[Inngest] STEP 3: getHtml() empty — retry ${i + 1} (waited ${waits[i]}ms)`);
          try {
            const project = stitchSdk.project(projectId);
            const fetched = await project.getScreen(screen.screenId);
            url = await fetched.getHtml();
            if (url) { console.log(`[Inngest] STEP 3: got url via getScreen (retry ${i + 1})`); break; }
          } catch (_) {}
          try {
            const project = stitchSdk.project(projectId);
            const screens = await project.screens();
            console.log(`[Inngest] STEP 3: list_screens returned ${screens.length} screens`);
            if (screens.length > 0) {
              const match = screens.find((s: any) => s.screenId === screen.screenId) || screens[screens.length - 1];
              if (match) { url = await match.getHtml(); }
              if (url) { console.log(`[Inngest] STEP 3: got url via list_screens (retry ${i + 1})`); break; }
            }
          } catch (_) {}
        }
      }
      // Last-resort: re-generate from scratch with the same prompt
      if (!url) {
        console.warn("[Inngest] STEP 3: all retries failed — re-generating with fresh Stitch call");
        await sleep(5000);
        const project2 = stitchSdk.project(projectId);
        const screen2 = await project2.generate(spec.stitchPrompt, "DESKTOP");
        await sleep(20000);
        url = await screen2.getHtml();
        if (!url) {
          const screens2 = await project2.screens();
          const match2 = screens2[screens2.length - 1];
          if (match2) url = await match2.getHtml();
        }
        if (!url) throw new Error("Stitch: no downloadUrl after generate + retries + re-generate");
      }

      // Fetch immediately — URL is a short-lived signed link, don't store it
      const html = await fetch(url).then(r => r.text()).catch(() => "");
      console.log(`[Inngest] STEP 3: fetched ${html.length} chars`);

      if (html.length < 5000) throw new Error(`Stitch HTML too short (${html.length} chars)`);
      if (/<h1>\s*HOME PAGE\s*<\/h1>/i.test(html)) throw new Error(`Stitch returned skeleton`);
      const styleLen = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("").length;
      const inlineStyleCount = (html.match(/\bstyle=/gi) || []).length;
      if (styleLen < 100 && inlineStyleCount < 20) {
        throw new Error(`Stitch HTML has no CSS (styleLen=${styleLen}, inlineStyles=${inlineStyleCount})`);
      }

      console.log(`[Inngest] STEP 3 DONE: HTML ${html.length} chars, styleLen=${styleLen}, inlineStyles=${inlineStyleCount}`);
      return html;
    }) as string;

    // ── STEP 4b: Structural injection into Stitch HTML ──────────────────────────
    // DO NOT rewrite or alter Stitch's design. Inject only what is structurally
    // missing: required IDs, mobile nav, multi-page wrappers, contact form, footer.
    // requestedPageIds at outer scope so step7b-validate and other steps can use it
    const requestedPageIds = (Array.isArray(userInput.pages) ? userInput.pages : ["Home"])
      .map((p: string) => normalizePageId(p));
    const rebuiltHtml = savedHtmlForRebuild ? savedHtmlForRebuild : await step.run("step4b-claude-rebuild", async () => {

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

      // ── Pure injection: DO NOT rewrite the Stitch design. ─────────────────────
      // Only inject structural IDs and missing elements. All CSS, layout, content
      // from Stitch is preserved exactly as-is.
      let html = stitchHtml;

      // 1. Inject id="hero" on the first large section if missing
      if (!html.includes('id="hero"') && !html.includes("id='hero'")) {
        html = html.replace(/(<section\b[^>]*)(>)/, (m: string, open: string, close: string) => {
          return open.includes("id=") ? m : open + ' id="hero"' + close;
        });
      }

      // 2. Inject mobile nav if hamburger button is missing
      if (!html.includes('id="hamburger"')) {
        const mobileNav = `
<div id="mobile-menu" style="display:none;position:fixed;top:0;right:0;width:80%;max-width:300px;height:100vh;z-index:9999;background:#1e293b;padding:24px;box-shadow:-4px 0 24px rgba(0,0,0,0.4);">
  <button onclick="document.getElementById('mobile-menu').style.display='none'" style="float:right;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">&times;</button>
  ${requestedPageIds.map((id: string) => `<a href="#${id}" onclick="document.getElementById('mobile-menu').style.display='none'" style="display:block;padding:12px 0;color:#f1f5f9;text-decoration:none;font-size:1rem;border-bottom:1px solid #334155;">${id.charAt(0).toUpperCase() + id.slice(1)}</a>`).join("\n  ")}
</div>
<button id="hamburger" onclick="document.getElementById('mobile-menu').style.display='block'" style="display:none;position:fixed;top:16px;right:16px;z-index:10000;background:none;border:none;cursor:pointer;padding:8px;">
  <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
  <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
  <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
</button>
<style>@media(max-width:768px){#hamburger{display:block!important;}}</style>`;
        html = html.replace(/<body[^>]*>/, (m: string) => m + mobileNav);
      }

      // 3. Inject id="contact" section if missing
      if (!html.includes('id="contact"')) {
        const contactSection = `
<section id="contact" style="padding:80px 24px;background:#0f172a;scroll-margin-top:80px;">
  <div style="max-width:640px;margin:0 auto;">
    <h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin:0 0 8px;text-align:center;">Get In Touch</h2>
    <p style="color:#94a3b8;text-align:center;margin:0 0 32px;">${clientPhone} &nbsp;|&nbsp; ${clientEmail}</p>
    <form onsubmit="window.location='mailto:${clientEmail}?subject=Website Enquiry&body=Name: '+encodeURIComponent(this.name.value)+'%0APhone: '+encodeURIComponent(this.phone.value)+'%0AMessage: '+encodeURIComponent(this.message.value);return false;" style="display:flex;flex-direction:column;gap:16px;">
      <input name="name" placeholder="Your Name" required style="padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:1rem;">
      <input name="email" type="email" placeholder="Your Email" required style="padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:1rem;">
      <input name="phone" placeholder="Your Phone" style="padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:1rem;">
      <textarea name="message" placeholder="Your Message" rows="4" required style="padding:12px 16px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:1rem;resize:vertical;"></textarea>
      <button type="submit" style="padding:14px;border-radius:8px;background:#22c55e;color:#fff;font-size:1rem;font-weight:700;border:none;cursor:pointer;">Send Message</button>
    </form>
  </div>
</section>`;
        html = html.replace(/<\/body>/i, contactSection + "\n</body>");
      }

      // 4. Inject footer with copyright if missing
      if (!html.includes("<footer")) {
        const yr4b = new Date().getFullYear();
        const footer = `<footer style="padding:32px 24px;background:#0a0f1a;text-align:center;color:#64748b;font-size:0.875rem;">&copy; ${yr4b} ${userInput.businessName}. All rights reserved.</footer>`;
        html = html.replace(/<\/body>/i, footer + "\n</body>");
      }

      // 5. Multi-page: wrap Stitch content in page-section divs if needed
      if (isMultiPage) {
        const hasDataPages = (html.match(/\bdata-page=/g) || []).length >= requestedPageIds.length;
        if (!hasDataPages) {
          const { html: ensuredHtml, report } = ensureMultiPageStructure(html, requestedPageIds, {
            businessName: userInput.businessName,
          });
          if (report.repairs.length > 0) {
            console.log("[Step4b] ensureMultiPageStructure added: [" + report.missingPagesAdded.join(",") + "]");
          }
          html = ensuredHtml;
        }
      }

      // 6. Inject booking section if needed and missing
      if (hasBookingFeature && bookingUrl && !html.includes('id="booking"')) {
        html = html.replace(/<\/body>/i, bookingBlock + "\n</body>");
      }

      html = repairHtml(html, userInput.businessName, new Date().getFullYear());

      const requiredIds = ['id="hero"', 'id="contact"'];
      const missingIds = requiredIds.filter(id => !html.includes(id));
      console.log("[Step4b] Injection complete: " + html.length + " chars. Missing ids: " + (missingIds.join(",") || "none"));

      return html;
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
      const clientCtaUrl = (userInput.existingWebsite || "").trim();
      html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
        const isCtaKw = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
        if (!isCtaKw) return match;
        if (attrs.includes('navigateTo') || attrs.includes('onclick')) return match;
        if (clientCtaUrl && clientCtaUrl.startsWith('http')) {
          return `<a${attrs.replace(/href=["']#["']/, `href="${clientCtaUrl}"`)} target="_blank" rel="noopener">${inner}</a>`;
        }
        return `<a${attrs} onclick="event.preventDefault();var el=document.getElementById('${bookingNavTarget}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${bookingNavTarget}');}">${inner}</a>`;
      });

      if (businessAddress) {
        // Use Embed API with key if available, otherwise fall back to the free maps?q= iframe (no key needed)
        const mapsEmbed = process.env.GOOGLE_MAPS_API_KEY
          ? `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`
          : `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(businessAddress)}&output=embed"></iframe></div>`;
        if (!/<iframe[^>]*google\.com\/maps/i.test(html) && !/<iframe[^>]*maps\.googleapis/i.test(html)) {
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

      // ── Video Background injection ──────────────────────────────────────────
      if (features.includes("Video Background")) {
        const rawVideoUrl = (userInput.videoUrl || "").trim();
        let embedVideoUrl = rawVideoUrl;
        // Convert youtube.com/watch?v=ID or youtu.be/ID to embed URL
        const ytMatch = rawVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
          embedVideoUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&muted=1&loop=1&playlist=${ytMatch[1]}&controls=0&showinfo=0&rel=0`;
        }
        // If no video URL provided, use a relevant Coverr stock video
        const stockVideoMap: Record<string, string> = {
          "food": "https://coverr.co/videos/chef-cooking/mp4",
          "hospitality": "https://coverr.co/videos/restaurant-table/mp4",
          "health": "https://coverr.co/videos/gym-workout/mp4",
          "fitness": "https://coverr.co/videos/gym-workout/mp4",
          "beauty": "https://coverr.co/videos/spa-relax/mp4",
          "construction": "https://coverr.co/videos/construction-site/mp4",
          "real estate": "https://coverr.co/videos/modern-house/mp4",
          "technology": "https://coverr.co/videos/coding/mp4",
        };
        const industryLower = (userInput.industry || "").toLowerCase();
        const stockUrl = Object.entries(stockVideoMap).find(([k]) => industryLower.includes(k))?.[1]
          || "https://coverr.co/videos/city-morning/mp4";

        if (!html.includes('id="hero-video"') && !html.includes("id='hero-video'")) {
          if (ytMatch && embedVideoUrl) {
            // YouTube iframe overlay on hero
            const iframeBlock = `<iframe id="hero-video" src="${embedVideoUrl}" frameborder="0" allow="autoplay;muted" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100vw;height:56.25vw;min-height:100%;min-width:177.77vh;z-index:0;pointer-events:none;" title="Hero background video"></iframe><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:1;"></div>`;
            html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>)/, (_m: string, open: string) => {
              return open.replace(/>$/, ` style="position:relative;overflow:hidden;">`) + iframeBlock;
            });
          } else {
            // MP4 or stock video
            const videoSrc = embedVideoUrl || stockUrl;
            const videoBlock = `<video id="hero-video" autoplay muted loop playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;" src="${videoSrc}"></video><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:1;"></div>`;
            html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>)/, (_m: string, open: string) => {
              return open.replace(/>$/, ` style="position:relative;overflow:hidden;">`) + videoBlock;
            });
          }
          // Ensure hero content sits above video (z-index:2)
          html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>[\s\S]{0,200}?)(<(?:div|h1|h2|p|button|a)[^>]*(?:class|style)=)/, (_m: string, before: string, tag: string) => {
            return before + tag.replace(/style="/, 'style="position:relative;z-index:2;');
          });
          console.log(`[Step5] Video background injected: ${embedVideoUrl || stockUrl}`);
        }
      }

      // ── Social media links injection ─────────────────────────────────────────
      const socialLinks = [
        userInput.facebookPage ? { name: "Facebook", url: userInput.facebookPage.startsWith("http") ? userInput.facebookPage : `https://${userInput.facebookPage}`, icon: "f", color: "#1877F2" } : null,
        userInput.instagramUrl ? { name: "Instagram", url: userInput.instagramUrl.startsWith("http") ? userInput.instagramUrl : `https://instagram.com/${userInput.instagramUrl.replace(/^@/, "")}`, icon: "in", color: "#E1306C" } : null,
        userInput.linkedinUrl ? { name: "LinkedIn", url: userInput.linkedinUrl.startsWith("http") ? userInput.linkedinUrl : `https://${userInput.linkedinUrl}`, icon: "li", color: "#0A66C2" } : null,
        userInput.tiktokUrl ? { name: "TikTok", url: userInput.tiktokUrl.startsWith("http") ? userInput.tiktokUrl : `https://tiktok.com/@${userInput.tiktokUrl.replace(/^@/, "")}`, icon: "tt", color: "#010101" } : null,
      ].filter(Boolean) as { name: string; url: string; icon: string; color: string }[];

      if (socialLinks.length > 0) {
        const socialHtml = socialLinks.map(s =>
          `<a href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.name}" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${s.color};color:#fff;text-decoration:none;font-size:12px;font-weight:700;margin:0 4px;">${s.icon}</a>`
        ).join("");
        const socialBlock = `<div class="wg-social-links" style="display:flex;align-items:center;gap:4px;margin-top:8px;">${socialHtml}</div>`;
        // Replace existing placeholder social links in footer
        html = html.replace(/<div[^>]*class="[^"]*(?:social|social-links|socials)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, (_m: string) => {
          if (_m.includes("wg-social-links")) return _m;
          return socialBlock;
        });
        // If no social links div found, inject into footer
        if (!html.includes("wg-social-links")) {
          html = html.replace(/<footer/i, socialBlock + "\n<footer");
        }
      }

      // ── Newsletter signup form injection ──────────────────────────────────────
      if (features.includes("Newsletter Signup") && !html.includes('id="newsletter-form"')) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
        const newsletterSection = `
<section id="newsletter" style="padding:64px 24px;background:linear-gradient(135deg,#0f1623 0%,#1a2332 100%);text-align:center;">
  <div style="max-width:600px;margin:0 auto;">
    <h2 style="color:#ffffff;font-size:2rem;font-weight:900;margin:0 0 12px;">Stay in the Loop</h2>
    <p style="color:#94a3b8;font-size:1rem;margin:0 0 32px;">Get tips, updates and exclusive offers from ${userInput.businessName} straight to your inbox.</p>
    <form id="newsletter-form" onsubmit="(function(e){e.preventDefault();var form=e.target;var em=form.querySelector(\'input[type=email]\');var btn=form.querySelector(\'button\');if(!em||!em.value)return;btn.textContent=\'Subscribing...\';btn.disabled=true;fetch(\'${appUrl}/api/newsletter-subscribe\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({email:em.value})}).then(function(r){return r.json();}).then(function(){btn.textContent=\'✓ Subscribed!\';btn.style.background=\'#10b981\';em.disabled=true;}).catch(function(){btn.textContent=\'Try again\';btn.disabled=false;});})(event)" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:480px;margin:0 auto;">
      <input type="email" name="email" placeholder="your@email.com.au" required style="flex:1;min-width:220px;padding:14px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#ffffff;font-size:0.95rem;outline:none;">
      <button type="submit" style="padding:14px 28px;border-radius:10px;background:#10b981;color:#000000;font-weight:700;font-size:0.95rem;border:none;cursor:pointer;white-space:nowrap;">Subscribe</button>
    </form>
    <p style="color:#475569;font-size:0.75rem;margin-top:16px;">No spam. Unsubscribe any time.</p>
  </div>
</section>`;
        // Inject before </body>
        html = html.replace("</body>", newsletterSection + "\n</body>");
        console.log("[Step5] Newsletter signup section injected");
      }

      // -- Pop-up Form -- timed lead-capture overlay (15s delay + exit intent) ---
      if (features.includes("Pop-up Form") && !html.includes('id="wg-popup"')) {
        const appUrl2 = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
        const popupHtml = `
<div id="wg-popup" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);align-items:center;justify-content:center;">
  <div style="background:#1a2332;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:48px 40px;max-width:440px;width:90%;position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
    <button onclick="document.getElementById('wg-popup').style.display='none';sessionStorage.setItem('wg-popup-closed','1');" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;line-height:1;">&times;</button>
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:2.2rem;margin-bottom:12px;">&#128293;</div>
      <h3 style="color:#ffffff;font-size:1.5rem;font-weight:900;margin:0 0 8px;">Don\'t Miss Out!</h3>
      <p style="color:#94a3b8;font-size:0.95rem;margin:0;">Join our list and get exclusive offers from ${userInput.businessName}.</p>
    </div>
    <form id="wg-popup-form" onsubmit="(function(e){e.preventDefault();var em=e.target.querySelector(\'input[type=email]\');var btn=e.target.querySelector(\'button[type=submit]\');if(!em||!em.value)return;btn.textContent=\'Subscribing...\';btn.disabled=true;fetch(\'${appUrl2}/api/newsletter-subscribe\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({email:em.value})}).then(function(){btn.textContent=\'Thanks! Check your inbox\';btn.style.background=\'#10b981\';em.disabled=true;setTimeout(function(){document.getElementById(\'wg-popup\').style.display=\'none\';sessionStorage.setItem(\'wg-popup-closed\',\'1\');},2000);}).catch(function(){btn.textContent=\'Try again\';btn.disabled=false;});})(event)">
      <input type="email" placeholder="your@email.com.au" required style="width:100%;box-sizing:border-box;padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#ffffff;font-size:0.95rem;margin-bottom:12px;outline:none;">
      <button type="submit" style="width:100%;padding:14px;border-radius:10px;background:#10b981;color:#000000;font-weight:800;font-size:1rem;border:none;cursor:pointer;">Get Exclusive Offers</button>
    </form>
    <p style="color:#475569;font-size:0.72rem;text-align:center;margin-top:14px;">No spam. Unsubscribe any time.</p>
  </div>
</div>
<script>
(function(){
  if(sessionStorage.getItem('wg-popup-closed'))return;
  var shown=false;
  function showPopup(){if(shown)return;shown=true;document.getElementById('wg-popup').style.display='flex';}
  setTimeout(showPopup,15000);
  document.addEventListener('mouseleave',function(e){if(e.clientY<=0)showPopup();});
})();
</script>`;
        html = html.replace("</body>", popupHtml + "\n</body>");
        console.log("[Step5] Pop-up form injected");
      }

      // ── Swap real testimonials in if provided ─────────────────────────────────
      if (userInput.realTestimonials && userInput.realTestimonials.trim()) {
        // Parse lines like: "Quote text" — Name, Location
        const testimonialLines = userInput.realTestimonials.split(/\n+/).filter((l: string) => l.trim().length > 10);
        if (testimonialLines.length > 0) {
          const cards = testimonialLines.map((line: string) => {
            const match = line.match(/[""](.+)[""][\s—-]+(.+)/);
            const quote = match ? match[1] : line.replace(/^[""]|[""]$/g, "").trim();
            const author = match ? match[2].trim() : "Verified Customer";
            return `<div style="background:rgba(255,255,255,0.06);border-radius:16px;padding:28px;border:1px solid rgba(255,255,255,0.1);">
  <div style="color:#f59e0b;font-size:1.1rem;margin-bottom:12px;">★★★★★</div>
  <p style="color:#e2e8f0;font-size:0.95rem;line-height:1.7;margin:0 0 16px;">"${quote}"</p>
  <p style="color:#10b981;font-weight:700;font-size:0.85rem;margin:0;">— ${author}</p>
</div>`;
          }).join("\n");
          const realTestimonialsSection = `<div class="wg-real-testimonials" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;padding:0 0 24px;">${cards}</div>`;
          // Replace existing testimonials content inside id="testimonials"
          html = html.replace(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i, (_m: string, open: string, _body: string, close: string) => {
            if (_m.includes("wg-real-testimonials")) return _m;
            return open + realTestimonialsSection + close;
          });
          console.log(`[Step5] Real testimonials injected (${testimonialLines.length} reviews)`);
        }
      }

      // Strip Stitch scripts that define navigateTo or page-switching.
      // Skip this on rebuild — the saved HTML already has our authoritative scripts;
      // stripping them causes the router to be missing until Step 6 re-injects it,
      // and any step in between that reads [data-page] count will get wrong results.
      if (!savedHtmlForRebuild) {
        html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (m: string, body: string) => {
          const definesNavigateTo = /function\s+navigateTo/.test(body) || /window\.navigateTo\s*=/.test(body) || /var\s+navigateTo\s*=/.test(body);
          const definesPageSwitch = /function\s+showPage/.test(body) || /function\s+switchPage/.test(body) || /\.page-section['"\s]*[,{]/.test(body);
          if (definesNavigateTo || definesPageSwitch) {
            console.log("[Step5] Stripped Stitch script (" + body.length + " chars, navigateTo=" + definesNavigateTo + " pageSwitch=" + definesPageSwitch + ")");
            return "";
          }
          return m;
        });
      } else {
        console.log("[Step5] Rebuild mode — skipping script strip to preserve injected navigateTo");
      }

      // Replace any showPage('id') calls with navigateTo('id') — all site types.
      const showPageCount = (html.match(/showPage\s*\(/g) || []).length;
      if (showPageCount > 0) {
        html = html.replace(/\bshowPage\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (_m: string, pageId: string) => {
          return `navigateTo('${pageId.toLowerCase()}')`;
        });
        console.log(`[Step5] Replaced ${showPageCount} showPage() calls with navigateTo()`);
      }

      // ── Strip markdown syntax from visible HTML text ─────────────────────────
      // Stitch sometimes renders literal **bold** or *italic* markdown in hero copy.
      // Strip it from text nodes between tags (but NOT inside <script>, <style>, or attributes).
      {
        // Remove <script> and <style> blocks, strip markdown from the rest, then put them back
        const preserved: string[] = [];
        let stripped = html.replace(/<(script|style)([\s\S]*?)<\/\1>/gi, (m: string) => {
          preserved.push(m);
          return `\x00PRESERVE${preserved.length - 1}\x00`;
        });
        // Strip **text** → text and *text* → text in text between tags
        stripped = stripped.replace(/>([^<]+)</g, (_m: string, text: string) => {
          const cleaned = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
          return `>${cleaned}<`;
        });
        // Restore preserved blocks
        html = stripped.replace(/\x00PRESERVE(\d+)\x00/g, (_m: string, idx: string) => preserved[Number(idx)]);
        const mdCount = (html.match(/\*\*[^<*]+\*\*/g) || []).length;
        if (mdCount === 0) console.log("[Step5] Markdown asterisks stripped from visible text");
        else console.warn(`[Step5] ${mdCount} markdown patterns remaining after strip`);
      }

      // ── SEO meta tags + Open Graph injection ─────────────────────────────────
      // Inject into <head> if not already present (rebuild-safe: check for og:title)
      if (!html.includes('property="og:title"')) {
        const pageTitle = spec.projectTitle || userInput.businessName;
        const metaDesc = (`${userInput.businessName} — ${userInput.usp || userInput.industry} in ${userInput.city || (userInput.businessAddress ? userInput.businessAddress.split(",").slice(-2).join(",").trim() : "Australia")}. ${userInput.goal || ""}`).slice(0, 160).trim();
        const lsiStr = Array.isArray(spec.lsiKeywords) && spec.lsiKeywords.length > 0
          ? spec.lsiKeywords.slice(0, 10).join(", ")
          : userInput.industry;
        const siteUrl = rawDomain ? `https://${rawDomain}` : "";
        const seoMeta = `
  <!-- SEO: WebGecko auto-generated -->
  <meta name="description" content="${metaDesc.replace(/"/g, "&quot;")}">
  <meta name="keywords" content="${lsiStr.replace(/"/g, "&quot;")}">
  <meta name="robots" content="index, follow">
  ${siteUrl ? `<link rel="canonical" href="${siteUrl}">` : ""}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${pageTitle.replace(/"/g, "&quot;")}">
  <meta property="og:description" content="${metaDesc.replace(/"/g, "&quot;")}">
  ${siteUrl ? `<meta property="og:url" content="${siteUrl}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle.replace(/"/g, "&quot;")}">
  <meta name="twitter:description" content="${metaDesc.replace(/"/g, "&quot;")}`;
        // Inject after <head> or <meta charset=...>
        if (html.includes("<head>")) {
          html = html.replace("<head>", "<head>" + seoMeta);
        } else {
          const charsetMatch = html.match(/<meta[^>]*charset[^>]*>/i);
          if (charsetMatch) {
            html = html.replace(charsetMatch[0], charsetMatch[0] + seoMeta);
          }
        }
        console.log("[Step5] SEO meta tags injected");
      }

      return html;
    });

    // ── STEP 6: Inject essentials + images (NO booking widget yet — auditor runs first) ─
    const injectedHtml = await step.run("step6-inject", async () => {
      const { html: checkedHtml } = checkAndFixLinks(fixedHtml, Array.isArray(userInput.pages) ? userInput.pages : []);
      const navFixedHtml = fixNavigateToTargets(checkedHtml);
      const ga4Id = job.ga4Id || userInput.ga4Id || "";

      // On rebuild, the saved HTML already has our injected scripts (navigateTo, multi-page
      // init, hamburger JS, etc.) from the original build. Re-running injectEssentials would
      // produce double <script> blocks. Skip it and only re-inject images.
      if (savedHtmlForRebuild) {
        console.log("[Step6] Rebuild mode — skipping injectEssentials (scripts already present), re-injecting images only");
        const html = injectImages(navFixedHtml, logoUrl, heroUrl, photoUrls, productsWithPhotos);
        return html;
      }

      // Create per-client Tawk.to property (Brain 1 — before Stitch)
      let tawktoPropertyId: string | undefined = undefined;
      if (features.includes("Live Chat")) {
        // First check if we already created one for this job (rebuild case)
        if (job.tawktoPropertyId) {
          tawktoPropertyId = job.tawktoPropertyId;
          console.log("[Step6] Tawk.to: reusing saved property:", tawktoPropertyId);
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
      const bookingOpenTag = isMultiPage
        ? '<section id="booking" data-page="booking" class="page-section" style="padding:80px 24px;background:#0a0f1a;scroll-margin-top:80px;">'
        : '<section id="booking" style="padding:80px 24px;background:#0a0f1a;scroll-margin-top:80px;">';
      const bookingComponent = bookingUrl
        ? [
            bookingOpenTag,
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
            isMultiPage ? '<section id="booking" data-page="booking" class="page-section" style="padding:80px 24px;background:#0a0f1a;text-align:center;scroll-margin-top:80px;">' : '<section id="booking" style="padding:80px 24px;background:#0a0f1a;text-align:center;scroll-margin-top:80px;">',
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
    // Parse shopProducts from either uploaded images (productsWithPhotos) or free-text input
    const shopProducts: { name: string; price: string; photoUrl?: string }[] = (() => {
      if (productsWithPhotos.length > 0) return productsWithPhotos;
      // Parse free-text e.g. "Coffee - $5\nCake slice - $8.50" or "Coffee, $5; Cake, $8"
      const raw = (userInput.shopProducts || "").trim();
      if (!raw) return [];
      return raw.split(/\n|;/).map((line: string) => {
        const cleaned = line.trim();
        if (!cleaned) return null;
        // Match "Name - $price" or "Name, $price" or "Name $price" or "Name: $price"
        const m = cleaned.match(/^(.+?)\s*[-:,]\s*\$?([\d]+(?:\.[\d]{1,2})?)\s*$/);
        if (m) return { name: m[1].trim(), price: `$${parseFloat(m[2]).toFixed(2)}` };
        // Fallback: treat whole line as name with no price
        return { name: cleaned, price: "$0.00" };
      }).filter(Boolean) as { name: string; price: string }[];
    })();

    const finalHtmlWithShop = await step.run("step7-shop", async () => {
      if (!hasShopFeature || shopProducts.length === 0) {
        console.log("[Step7] Shop skipped: hasShopFeature=" + hasShopFeature + " products=" + shopProducts.length);
        return finalHtml;
      }
      let html = finalHtml;
      try {
        const siteUrl = `https://${vercelProjectName}.vercel.app`;
        // Use client Square OAuth token, or fall back to manual payment URL from portal
        const clientSquareToken = job.squareAccessToken || undefined;
        const clientSquareLocation = job.squareLocationId || undefined;
        let manualPaymentUrl = "";
        if (!clientSquareToken) {
          try {
            const { data: clientRow } = await supabase.from("clients").select("shop_payment_url").eq("job_id", jobId).single();
            manualPaymentUrl = clientRow?.shop_payment_url || "";
          } catch {}
        }
        // Fall back to WebGecko master Square account if client hasn't connected their own yet
        const effectiveToken = clientSquareToken || process.env.SQUARE_ACCESS_TOKEN || "";
        const effectiveLocation = clientSquareLocation || process.env.SQUARE_LOCATION_ID || "";
        if (!effectiveToken && !manualPaymentUrl) {
          console.warn(`[Step7] No Square token and no manual payment URL for ${jobId} — shop buttons inactive`);
          return html;
        }
        let catalogueItems: any[] = [];
        if (effectiveToken) {
          console.log(`[Step7] Using ${clientSquareToken ? "client" : "WebGecko master"} Square token`);
          catalogueItems = await createClientShopCatalogue({ jobId, businessName: userInput.businessName, products: shopProducts, redirectUrl: siteUrl, accessToken: effectiveToken, locationId: effectiveLocation });
          await supabase.from("jobs").update({ user_input: { ...userInput, shopCatalogue: catalogueItems } }).eq("id", jobId);
        } else {
          console.log(`[Step7] Using manual payment URL: ${manualPaymentUrl}`);
          catalogueItems = shopProducts.map((p: any, i: number) => ({ name: p.name, variationId: "", itemId: "", priceCents: Math.round(parseFloat((p.price || "0").replace(/[^0-9.]/g, "")) * 100), paymentLinkUrl: manualPaymentUrl, paymentLinkId: "" }));
        }

        // Strategy 1: pre-tagged wg-buy-btn buttons
        catalogueItems.forEach((item: any, i: number) => {
          if (!item.paymentLinkUrl) return;
          const btnPattern = new RegExp(`<button([^>]*class="[^"]*wg-buy-btn[^"]*"[^>]*data-product-index="${i}"[^>]*)>[^<]*<\/button>`, "gi");
          const anchorPattern = new RegExp(`<button([^>]*data-product-index="${i}"[^>]*class="[^"]*wg-buy-btn[^"]*"[^>]*)>[^<]*<\/button>`, "gi");
          const replacement = `<a href="${item.paymentLinkUrl}" target="_blank" rel="noopener" class="wg-buy-btn" data-product-index="${i}" style="display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:0.95rem;">Buy Now — $${(item.priceCents / 100).toFixed(2)}</a>`;
          html = html.replace(btnPattern, replacement).replace(anchorPattern, replacement);
        });
        // Strategy 2: find product card by name, wire first generic buy button within 3000 chars
        catalogueItems.forEach((item: any, i: number) => {
          if (!item.paymentLinkUrl || html.includes(`data-product-index="${i}"`)) return;
          const escapedName = item.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          const buyBtnRe = /(<(?:button|a)(?:[^>]*)>)\s*(?:Buy Now|Add to Cart|Order Now|Shop Now|Purchase|Buy)\s*(<\/(?:button|a)>)/i;
          const nameIdx = html.search(new RegExp(escapedName, "i"));
          if (nameIdx === -1) return;
          const win = html.slice(nameIdx, nameIdx + 3000);
          if (!buyBtnRe.test(win)) return;
          html = html.slice(0, nameIdx) + win.replace(buyBtnRe, `<a href="${item.paymentLinkUrl}" target="_blank" rel="noopener" class="wg-buy-btn" data-product-index="${i}" style="display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:0.95rem;">Buy Now — $${(item.priceCents / 100).toFixed(2)}</a>`) + html.slice(nameIdx + 3000);
        });
        // Strategy 3: inject fallback shop section for unmatched products
        const unlinked = catalogueItems.filter((_: any, i: number) => !html.includes(`data-product-index="${i}"`));
        if (unlinked.length > 0) {
          const cards = catalogueItems.map((item: any, i: number) => `  <div style="background:#1e293b;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;"><h3 style="color:#f1f5f9;font-size:1.1rem;font-weight:700;margin:0;">${item.name}</h3><p style="color:#10b981;font-weight:700;font-size:1.2rem;margin:0;">$${(item.priceCents/100).toFixed(2)}</p><a href="${item.paymentLinkUrl}" target="_blank" rel="noopener" class="wg-buy-btn" data-product-index="${i}" style="display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;width:100%;">Buy Now</a></div>`).join("\n");
          html = html.replace("</body>", `<section id="shop" style="padding:80px 24px;background:#0f172a;"><div style="max-width:1200px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;text-align:center;margin:0 0 48px;">Shop</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px;">${cards}</div></div></section>\n</body>`);
        }
        const squareBadge = clientSquareToken ? `<div style="text-align:center;margin-top:16px;padding:8px;"><p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0;">Secure checkout powered by Square</p></div>` : "";
        html = html.replace(/(<section[^>]*(?:id|class)="[^"]*shop[^"]*"[^>]*>[\s\S]*?)(<\/section>)/gi, (_m: string, body: string, close: string) => body + squareBadge + close);
      } catch (e) {
        console.error("[Inngest] STEP 7: Shop catalogue failed:", e);
      }
      return html;
    });

    // ── STEP 7b: Pre-deploy validation ──────────────────────────────────────
    const deployReady = await step.run("step7b-validate", async () => {
      const failures = validateForDeploy(finalHtmlWithShop, requestedPageIds, isMultiPage, hasBookingFeature);
      if (failures.length > 0) {
        console.error("[Step7b] Pre-deploy validation FAILED:", failures.join("; "));

        // Pass 1: structural repair (truncated tags, missing footer/body/html)
        let repaired = repairHtml(finalHtmlWithShop, userInput.businessName, new Date().getFullYear());


        // Pass 1b: force-inject id="hero" on first section/div if still missing
        if (!repaired.includes('id="hero"') && !repaired.includes("id='hero'")) {
          repaired = repaired.replace(
            /(<(?:section|div)\b)([^>]*)(>)/,
            (m: string, tag: string, attrs: string, close: string) =>
              attrs.includes("id=") ? m : tag + attrs + ' id="hero"' + close
          );
          console.warn("[Step7b] Force-injected id=hero on first section/div");
        }
        // Pass 2: for multi-page, run ensureMultiPageStructure to guarantee all page wrappers
        if (isMultiPage) {
          const { html: ensuredHtml, report } = ensureMultiPageStructure(repaired, requestedPageIds, {
            businessName: userInput.businessName,
          });
          if (report.repairs.length > 0) {
            console.warn("[Step7b] ensureMultiPageStructure applied " + report.repairs.length + " emergency repairs. Added: [" + report.missingPagesAdded.join(",") + "]");
          }
          repaired = ensuredHtml;
        }

        const failuresAfterRepair = validateForDeploy(repaired, requestedPageIds, isMultiPage, hasBookingFeature);
        if (failuresAfterRepair.length > 0) {
          console.error("[Step7b] Still failing after repair:", failuresAfterRepair.join("; "));
          resend.emails.send({
            from: "WebGecko Pipeline <hello@webgecko.au>",
            to: "crayzewastaken@gmail.com",
            subject: "⚠️ Pre-deploy validation failed — " + userInput.businessName,
            html: "<p>Build for <strong>" + userInput.businessName + "</strong> (job: " + jobId + ") has validation failures:<br><ul>" + failuresAfterRepair.map((f: string) => "<li>" + f + "</li>").join("") + "</ul></p>",
          }).catch(() => {});
          throw new Error("[Step7b] Pre-deploy validation failed after repair: " + failuresAfterRepair.join("; "));
        }
        console.log("[Step7b] Repaired HTML passes validation");
        return { html: repaired, valid: true, failures: [] };
      }
      console.log("[Step7b] Pre-deploy validation passed");
      return { html: finalHtmlWithShop, valid: true, failures: [] };
    });
    const deployHtml = deployReady.html;

    // ── STEP 8: Deploy to Vercel ──────────────────────────────────────────────
    const previewUrl = await step.run("step8-deploy", async () => {
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vercelProjectName,
          teamId: process.env.VERCEL_TEAM_ID || undefined,
          files: (() => {
            const siteUrl = `https://${vercelProjectName}.vercel.app`;
            const customUrl = rawDomain ? `https://${rawDomain}` : siteUrl;
            const now = new Date().toISOString().split("T")[0];
            const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${customUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`;
            const robots = `User-agent: *\nAllow: /\nSitemap: ${customUrl}/sitemap.xml`;
            return [
              { file: "index.html", data: deployHtml, encoding: "utf-8" },
              { file: "sitemap.xml", data: sitemap, encoding: "utf-8" },
              { file: "robots.txt", data: robots, encoding: "utf-8" },
            ];
          })(),
          projectSettings: { framework: null, outputDirectory: "./" },
        }),
      });
      if (!deployRes.ok) { console.error("[Inngest] Deploy failed:", await deployRes.text()); return ""; }
      const siteUrl = `https://${vercelProjectName}.vercel.app`;
      // Fire-and-forget Google Indexing API ping — never blocks deploy
      requestGoogleIndexing(siteUrl).catch(() => {});
      return siteUrl;
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
      checks.push({ label: "Hero section",
        // Multi-page: hero can be nested inside home page wrapper; single-page: needs id="hero"
        pass: /id=["']hero["']/.test(liveHtml) || (isMultiPage && /data-page=["']home["']/.test(liveHtml) && /<h1[\s>]/i.test(liveHtml)),
        severity: "warn"  });
      checks.push({ label: "Contact section",
        pass: /id=["']contact["']/.test(liveHtml) || (isMultiPage && /data-page=["']contact["']/.test(liveHtml)),
        severity: "warn"  });
      checks.push({ label: "Testimonials section",
        pass: /id=["']testimonials["']/.test(liveHtml) || /testimonial|review/i.test(liveHtml),
        severity: "warn"  });
      checks.push({ label: "FAQ section",
        pass: /id=["']faq["']/.test(liveHtml) || /<details[\s>]|accordion/i.test(liveHtml),
        severity: "warn"  });
      checks.push({ label: "Footer copyright",       pass: liveHtml.includes("©") || liveHtml.includes("&copy;") || liveHtml.includes("All rights reserved"),                 severity: "warn"  });
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
    let loopHtml = deployHtml;
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
          patched = patched.replace("</body>", '<script>\n' + 'window.navigateTo=function(pageId){\n' + '  var d=document.getElementById("mobile-menu")||document.getElementById("mobile-drawer")||document.getElementById("side-drawer");\n' + '  if(d){d.classList.remove("translate-x-0");d.classList.add("translate-x-full","hidden");d.style.display="none";}\n' + '  var ss=document.querySelectorAll("[data-page]");\n' + '  if(ss.length>1){ss.forEach(function(s){s.classList.remove("active");});var t=document.querySelector("[data-page=\\"" + pageId + "\\"]")||document.getElementById(pageId);if(t){t.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});}return;}\n' + '  var el=document.getElementById(pageId);if(el)el.scrollIntoView({behavior:"smooth"});\n' + '};\n' + '</script>\n</body>');

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
      // Re-read job to get latest metadata (webhook may have set scheduledReleaseAt after load-job ran)
      const latestJob = await getJob(jobId) || job;
      await saveJob(jobId, {
        ...latestJob,
        html: deployedHtml,
        title: spec.projectTitle,
        fileName,
        domainSlug,
        vercelProjectName,
        status: "completed",  // autoRelease filters for "completed"
        previewUrl: deployedUrl,
        builtAt: new Date().toISOString(),
        metadata: {
          ...(latestJob.metadata || {}),
          // Store last good HTML snapshot for rollback
          lastGoodHtml: deployedHtml,
          lastGoodUrl: deployedUrl,
          lastGoodAt: new Date().toISOString(),
          // Preserve scheduledReleaseAt set by webhook; set it now if missing (e.g. admin-activated jobs)
          seo: {
            lsiKeywords: Array.isArray(spec.lsiKeywords) ? spec.lsiKeywords : [],
            metaDescription: (`${userInput.businessName} — ${userInput.usp || userInput.industry} in ${userInput.businessAddress || "Australia"}`).slice(0, 160),
            serpInsights: spec.serpInsights || null,
            projectTitle: spec.projectTitle || "",
          },
          scheduledReleaseAt: latestJob.metadata?.scheduledReleaseAt || (() => {
            const relDays = (() => {
              const feats: string[] = Array.isArray(latestJob.userInput?.features) ? latestJob.userInput.features : [];
              const pgs: string[] = Array.isArray(latestJob.userInput?.pages) ? latestJob.userInput.pages : [];
              let d = 10;
              if (latestJob.userInput?.siteType === "multi" || pgs.length > 3) d += 1;
              if (feats.length > 3) d += 1;
              return Math.min(d, 12);
            })();
            return new Date(Date.now() + relDays * 24 * 60 * 60 * 1000).toISOString();
          })(),
        },
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

        // -- STEP 9b: Domain provisioning via Synergy Wholesale (non-blocking) ------
    // Runs only if client supplied a customDomain. SYNERGY_DEMO=true = dry-run.
    await step.run("step9b-domain", async () => {
      const rawDomain = (userInput.domain || "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (!rawDomain || !rawDomain.includes(".")) {
        console.log("[Step9b] No custom domain requested -- skipping");
        return;
      }
      try {
        const result = await provisionClientDomain({
          domainName: rawDomain,
          businessName: userInput.businessName,
          contactFirstName: userInput.businessName.split(" ")[0] || "Contact",
          contactLastName: userInput.businessName.split(" ").slice(1).join(" ") || "Name",
          contactEmail: clientEmail,
          contactPhone: clientPhone.replace(/[^0-9+]/g, "").replace(/^0/, "+61") || "+61.400000000",
          contactAddress: userInput.businessAddress || "Australia",
          contactCity: (userInput.businessAddress || "").split(",")[0] || "Sydney",
          contactState: "NSW",
          contactPostcode: "2000",
          auEligibilityType: "ABN",
          auEligibilityName: userInput.businessName,
          auEligibilityId: userInput.abn || undefined,
        });
        const latestJob2 = await getJob(jobId) || job;
        await saveJob(jobId, {
          ...latestJob2,
          domain: rawDomain,
          metadata: { ...(latestJob2.metadata || {}), domainStatus: result.status, domainUrl: result.url },
        });
        console.log("[Step9b] Domain provisioned:", result.url, "status:", result.status);
      } catch (e) {
        console.error("[Step9b] Domain provisioning failed (non-fatal):", e);
      }
    });

    // ── STEP 10: Email owner ──────────────────────────────────────────────────
    await step.run("step10-email", async () => {
      const base = (process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app");
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
        { label: "Hero section", check: /id=["']hero["']/.test(deployedHtml) || (isMultiPage && /data-page=["']home["']/.test(deployedHtml) && /<h1[\s>]/i.test(deployedHtml)) },
        { label: "Sticky nav + hamburger", check: deployedHtml.includes('id="hamburger"') },
        { label: "Testimonials section", check: /id=["']testimonials["']/.test(deployedHtml) || /testimonial|review/i.test(deployedHtml) },
        { label: "FAQ accordion", check: /id=["']faq["']/.test(deployedHtml) || /<details[\s>]|accordion/i.test(deployedHtml) },
        { label: "Contact form", check: /id=["']contact["']/.test(deployedHtml) || (isMultiPage && /data-page=["']contact["']/.test(deployedHtml)) },
        { label: "Real email injected", check: deployedHtml.includes(clientEmail) },
        { label: "Real phone injected", check: deployedHtml.includes(clientPhone.replace(/\s/g, "")) || deployedHtml.includes(clientPhone) },
        { label: "Google Maps embedded", check: deployedHtml.includes("google.com/maps") },
        { label: "Booking widget", check: hasBookingFeature && (deployedHtml.includes("supersaas.com") || (bookingUrl ? deployedHtml.includes(bookingUrl) : false) || deployedHtml.includes('id="booking"')) },
        { label: "Footer with copyright", check: deployedHtml.includes("&copy;") || deployedHtml.includes("All rights reserved") },
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
    ${hasBookingFeature && !job.supersaasId ? `<div style="background:#1a0a0a;border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:#ef4444;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">⚠️ Manual Action Required — SuperSaas Schedule</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 12px;">The SuperSaas schedule could not be created automatically. You need to create it manually.</p>
      <ol style="color:#e2e8f0;font-size:13px;margin:0 0 12px;padding-left:20px;line-height:2;">
        <li>Go to <a href="https://www.supersaas.com/dashboard" style="color:#f87171;">supersaas.com/dashboard</a></li>
        <li>Click <strong>New Schedule</strong></li>
        <li>Name it exactly: <strong style="color:#fbbf24;font-family:monospace;">${fileName}</strong></li>
        <li>Configure hours, slot duration, notifications to <strong>${clientEmail}</strong></li>
        ${userInput.bookingServices ? "<li>Add a <strong>Drop-down list</strong> field named &quot;Service&quot; with options: <strong>" + userInput.bookingServices + "</strong></li>" : ""}
        <li>Save — the booking iframe on the site will automatically use this schedule</li>
        <li>Once done, click <a href="${base}/api/pipeline/run?jobId=${jobId}&secret=${secret}" style="color:#fbbf24;font-weight:700;">🔄 Rebuild Site</a> to go live</li>
      </ol>
      <p style="color:#475569;font-size:12px;margin:0;">Schedule URL will be: <span style="color:#94a3b8;font-family:monospace;">supersaas.com/schedule/webgecko/${fileName}</span></p>
    </div>` : ""}
    ${hasBookingFeature && job.supersaasId ? `<div style="background:#0a1a0a;border:1px solid rgba(0,200,150,0.2);border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:#00c896;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">✅ SuperSaas Schedule Auto-Created</p>
      <p style="color:#94a3b8;font-size:13px;margin:0;">Schedule <strong style="color:#e2e8f0;">${fileName}</strong> (ID: ${job.supersaasId}) was created automatically and embedded in the site.</p>
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
        if (new Date(releaseAt) > now) continue;

        console.log("[AutoRelease] Releasing job", job.id, "scheduled for", releaseAt);
        try {
          const base = (process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app");
          await fetch(`${base}/api/preview-unlock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: job.id, clientSlug: job.client_slug }),
          });
          await supabase.from("jobs").update({ metadata: { ...job.metadata, alreadyReleased: true } }).eq("id", job.id);
          console.log("[AutoRelease] Released job", job.id);
        } catch (e) {
          console.warn("[AutoRelease] Failed for job", job.id, e instanceof Error ? e.message : String(e));
        }
      }
    });
  }
);

// ─── Feature Inject (draft → review → live) ───────────────────────────────────
// Triggered when admin approves a feature request.
// Injects the requested feature into the saved HTML, deploys to a draft URL,
// then updates the feature request status to "draft" so admin can review.

const featureInject = inngest.createFunction(
  {
    id: "feature-inject",
    name: "Inject Feature into Draft",
    retries: 1,
    triggers: [{ event: "feature/inject" }],
  },
  async ({ event, step }: { event: { data: { jobId: string; requestId: string; featureId: string } }; step: any }) => {
    const { jobId, requestId, featureId } = event.data;

    const draftUrl = await step.run("inject-and-deploy-draft", async () => {
      const job = await getJob(jobId);
      if (!job) throw new Error("Job not found: " + jobId);
      if (!job.html || job.html.length < 1000) throw new Error("No saved HTML to inject into");

      const userInput = job.userInput || {};
      const existingFeatures: string[] = Array.isArray(userInput.features) ? userInput.features : [];

      // Add the new feature to a temporary copy of userInput
      const augmentedInput = {
        ...userInput,
        features: [...new Set([...existingFeatures, featureId])],
      };

      // Re-run post-processing injections on the saved HTML
      const domainSlug = job.domainSlug || safeFileName(userInput.businessName || "client");
      const draftProjectName = ("wg-" + domainSlug + "-draft").slice(0, 52);

      // Build a minimal job copy with augmented features for injection
      const draftJob = { ...job, userInput: augmentedInput };

      // For booking injection: ensure we have supersaasId if feature is Booking
      let htmlForDraft = job.html;

      if (featureId === "Live Chat" && job.tawktoPropertyId) {
        const tawkScript = `<script type="text/javascript">var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${job.tawktoPropertyId}/default';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();</script>`;
        if (!htmlForDraft.includes(job.tawktoPropertyId)) {
          htmlForDraft = htmlForDraft.replace("</body>", tawkScript + "\n</body>");
        }
      }

      if (featureId === "Booking System" && job.supersaasId) {
        const iframeSrc = `https://www.supersaas.com/schedule/${job.supersaasId}`;
        const bookingSection = `<section id="booking" style="padding:80px 20px;background:#0a0f1a;text-align:center;">
<h2 style="color:#e2e8f0;font-size:2rem;font-weight:800;margin-bottom:8px;">Book Online</h2>
<p style="color:#94a3b8;margin-bottom:32px;">Select a time that works for you</p>
<iframe src="${iframeSrc}" width="100%" height="700" frameborder="0" scrolling="auto" style="border-radius:12px;max-width:900px;"></iframe>
</section>`;
        if (!htmlForDraft.includes('id="booking"')) {
          htmlForDraft = htmlForDraft.replace("</body>", bookingSection + "\n</body>");
        }
      }

      if (featureId === "Newsletter" || featureId === "Growth") {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
        const newsletterSection = `<section id="newsletter" style="padding:60px 20px;background:#0a1628;text-align:center;">
<h2 style="color:#e2e8f0;font-size:1.8rem;font-weight:800;margin-bottom:8px;">Stay in the Loop</h2>
<p style="color:#94a3b8;margin-bottom:24px;">Get updates and exclusive offers straight to your inbox.</p>
<form onsubmit="(function(e){e.preventDefault();var em=e.target.querySelector('input[type=email]');var btn=e.target.querySelector('button');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${appUrl}/api/newsletter-subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value})}).then(function(){btn.textContent='Subscribed!';btn.style.background='#10b981';em.disabled=true;}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;max-width:480px;margin:0 auto;">
<input type="email" placeholder="Your email address" required style="flex:1;min-width:220px;padding:12px 16px;border-radius:8px;border:1px solid #1e2d42;background:#0d1520;color:#e2e8f0;font-size:14px;outline:none;">
<button type="submit" style="background:#00c896;color:#000;font-weight:700;padding:12px 24px;border-radius:8px;border:none;cursor:pointer;font-size:14px;">Subscribe</button>
</form>
</section>`;
        if (!htmlForDraft.includes('id="newsletter"')) {
          htmlForDraft = htmlForDraft.replace("</body>", newsletterSection + "\n</body>");
        }
      }

      if (featureId === "Shop") {
        const shopSection = `<section id="shop" style="padding:80px 20px;background:#060a14;">
<h2 style="color:#e2e8f0;font-size:2rem;font-weight:800;text-align:center;margin-bottom:8px;">Shop</h2>
<p style="color:#94a3b8;text-align:center;margin-bottom:40px;">Browse our products below</p>
<div id="wg-shop-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;max-width:1100px;margin:0 auto;">
<div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;">
<h3 style="color:#f1f5f9;margin-bottom:8px;">Product</h3>
<p style="color:#10b981;font-weight:700;margin-bottom:16px;">Contact us for pricing</p>
<a href="#contact" style="display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Buy Now</a>
</div>
</div>
</section>`;
        if (!htmlForDraft.includes('id="shop"')) {
          htmlForDraft = htmlForDraft.replace("</body>", shopSection + "\n</body>");
        }
      }

      // Deploy to draft project
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.VERCEL_API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftProjectName,
          target: "production",
          files: [{ file: "index.html", data: htmlForDraft, encoding: "utf-8" }],
          projectSettings: { framework: null },
        }),
      });

      if (!deployRes.ok) {
        const err = await deployRes.text();
        throw new Error("Draft deploy failed: " + err.slice(0, 200));
      }

      const draftSiteUrl = `https://${draftProjectName}.vercel.app`;

      // Update feature request to "draft" with the draft URL
      const { data: jobRow } = await supabase.from("jobs").select("metadata").eq("id", jobId).single();
      const requests: any[] = jobRow?.metadata?.featureRequests || [];
      const idx = requests.findIndex((r: any) => r.id === requestId);
      if (idx !== -1) {
        requests[idx] = { ...requests[idx], status: "draft", draftUrl: draftSiteUrl, updatedAt: new Date().toISOString() };
        await supabase.from("jobs").update({ metadata: { ...(jobRow?.metadata || {}), featureRequests: requests } }).eq("id", jobId);
      }

      // Notify admin
      const secret = process.env.ADMIN_SESSION_SECRET?.slice(0, 16) || "";
      const adminUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app") + `/admin?secret=${encodeURIComponent(secret)}`;
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL || "hello@webgecko.au",
        subject: `🎨 Draft ready — ${featureId} for ${userInput.businessName || jobId}`,
        html: `<div style="font-family:sans-serif;padding:32px;background:#0a0f1a;color:#e2e8f0;max-width:600px;border-radius:12px;">
<h2 style="color:#00c896;">Draft Ready for Review</h2>
<p><strong>${featureId}</strong> has been injected into a draft for <strong>${userInput.businessName || jobId}</strong>.</p>
<p><a href="${draftSiteUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-bottom:12px;">View Draft →</a></p>
<p>Once you're happy, go to <a href="${adminUrl}" style="color:#00c896;">Admin Dashboard</a> → Feature Requests → mark as <strong>Live</strong> to push to the client's real site.</p>
</div>`,
      });

      console.log("[FeatureInject] Draft deployed:", draftSiteUrl, "for", featureId, "job", jobId);
      return draftSiteUrl;
    });

    return { ok: true, draftUrl };
  }
);

// ─── Feature Go Live ──────────────────────────────────────────────────────────
// When admin marks a feature request as "live", we push the draft HTML
// to the real site by triggering a rebuild with the new feature included.

const featureGoLive = inngest.createFunction(
  {
    id: "feature-go-live",
    name: "Go Live with Feature",
    retries: 1,
    triggers: [{ event: "feature/go-live" }],
  },
  async ({ event, step }: { event: { data: { jobId: string; requestId: string; featureId: string } }; step: any }) => {
    const { jobId, requestId, featureId } = event.data;

    await step.run("update-job-features-and-rebuild", async () => {
      const job = await getJob(jobId);
      if (!job) throw new Error("Job not found");

      const userInput = job.userInput || {};
      const existingFeatures: string[] = Array.isArray(userInput.features) ? userInput.features : [];
      const newFeatures = [...new Set([...existingFeatures, featureId])];

      // Persist the new feature into userInput
      await saveJob(jobId, {
        ...job,
        userInput: { ...userInput, features: newFeatures },
      });

      // Mark request as live
      const { data: jobRow } = await supabase.from("jobs").select("metadata").eq("id", jobId).single();
      const requests: any[] = jobRow?.metadata?.featureRequests || [];
      const idx = requests.findIndex((r: any) => r.id === requestId);
      if (idx !== -1) {
        requests[idx] = { ...requests[idx], status: "live", updatedAt: new Date().toISOString() };
        await supabase.from("jobs").update({ metadata: { ...(jobRow?.metadata || {}), featureRequests: requests } }).eq("id", jobId);
      }
    });

    // Fire a rebuild — isRebuild=true so it reuses HTML but re-runs injections with new feature
    await inngest.send({ name: "build/website", data: { jobId, isRebuild: true } });

    return { ok: true };
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports, autoRelease, featureInject, featureGoLive],
});
