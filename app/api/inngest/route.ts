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
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { createSuperSaasSchedule, generateBookingEmbed } from "@/lib/supersaas";
import { createClientShopCatalogue } from "@/lib/square";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability, getAnalyticsCount, getBookingsForJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { createTawktoProperty } from "@/lib/tawkto";
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

    // ── STEP 5: Code-only fix pass ────────────────────────────────────────────
    const fixedHtml = await step.run("step5-code-fix", async () => {
      let html = stitchHtml;
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
      // our injected script in pipeline-helpers handles all of this correctly.
      // Only strip scripts that explicitly define these functions to avoid over-stripping.
      html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (m: string, body: string) => {
        const definesNavigateTo = /function\s+navigateTo\b/.test(body) || /window\.navigateTo\s*=/.test(body) || /var\s+navigateTo\s*=/.test(body);
        const definesPageSwitch = /function\s+showPage\b/.test(body) || /function\s+switchPage\b/.test(body) || /\.page-section['"\s]*[,{]/.test(body);
        if (definesNavigateTo || definesPageSwitch) {
          console.log("[Step5] Stripped conflicting Stitch script (" + body.length + " chars, navigateTo=" + definesNavigateTo + " pageSwitch=" + definesPageSwitch + ")");
          return "";
        }
        return m;
      });

      return html;
    });

    // ── STEP 6: Inject essentials + images (NO booking widget yet — auditor runs first) ─
    const injectedHtml = await step.run("step6-inject", async () => {
      const { html: checkedHtml } = checkAndFixLinks(fixedHtml, Array.isArray(userInput.pages) ? userInput.pages : []);
      const ga4Id = job.ga4Id || userInput.ga4Id || "";
      const tawktoPropertyId = features.includes("Live Chat")
        ? (process.env.TAWKTO_PROPERTY_ID || undefined)
        : undefined;
      let html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id, tawktoPropertyId);
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

    // ── STEP 6c: Booking embed injection (AFTER auditor so id="booking" is guaranteed) ─
    // Uses client's own URL if provided, otherwise auto-creates a SuperSaas schedule.
    const finalHtml = await step.run("step6c-booking", async () => {
      if (!hasBookingFeature) return auditedHtml;
      let html = auditedHtml;
      try {
        // Extract accent colour from CSS vars or button styles
        let accentColor = "#10b981";
        const cssVarMatch = html.match(/--(?:primary|accent|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/);
        if (cssVarMatch?.[1]) accentColor = cssVarMatch[1];
        else {
          const ctaBgMatch = html.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/);
          if (ctaBgMatch?.[1] && ctaBgMatch[1] !== "#000000" && ctaBgMatch[1] !== "#ffffff") accentColor = ctaBgMatch[1];
        }

        // Determine booking URL — client's own or auto-create SuperSaas schedule
        let bookingUrl = (userInput.existingBookingUrl || "").trim();
        if (!bookingUrl) {
          console.log("[Step6c] No existing booking URL — creating SuperSaas schedule");
          const schedule = await createSuperSaasSchedule({
            businessName: userInput.businessName,
            clientEmail,
            timezone: "Australia/Brisbane",
          });
          if (schedule) {
            bookingUrl = schedule.embedUrl;
            // Persist the schedule URL on the job so it's retrievable later
            await saveJob(jobId, { ...job, supersaasUrl: schedule.embedUrl, supersaasId: schedule.id });
            console.log(`[Step6c] SuperSaas schedule created: ${bookingUrl}`);
          } else {
            console.warn("[Step6c] SuperSaas creation failed — booking section will be placeholder");
          }
        } else {
          console.log(`[Step6c] Using client-provided booking URL: ${bookingUrl}`);
        }

        const bookingWidgetHtml = bookingUrl
          ? generateBookingEmbed({ bookingUrl, businessName: userInput.businessName, primaryColor: accentColor })
          : `<section id="booking" style="padding:80px 24px;background:#0a0f1a;text-align:center;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;">Book an Appointment</h2><p style="color:#94a3b8;margin-top:16px;">Contact us to schedule your appointment.</p></section>`;

        // Find id="booking" element and replace its entire content using a depth counter
        // (regex can't reliably match nested tags, so we walk the string manually)
        const bookingIdx = html.indexOf('id="booking"');
        console.log(`[Step6c] id="booking" present: ${bookingIdx !== -1} at idx ${bookingIdx}, html length: ${html.length}`);
        const bookingOpenMatch = html.match(/<(section|div)([^>]*\bid="booking"[^>]*)>/i);
        console.log(`[Step6c] bookingOpenMatch: ${bookingOpenMatch ? bookingOpenMatch[0].slice(0,80) : "null"}`);
        if (bookingOpenMatch) {
          const openTag = bookingOpenMatch[0];
          const tagName = bookingOpenMatch[1].toLowerCase();
          const startIdx = html.indexOf(openTag);
          // Walk forward counting open/close tags of the same type to find the matching close
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
          // pos now points to just after the closing tag
          const fullElement = html.slice(startIdx, pos);
          html = html.slice(0, startIdx) + bookingWidgetHtml + html.slice(pos);
          console.log(`[Step6c] Replaced element (${fullElement.length} chars). SuperSaas injected: ${html.includes("supersaas.com")}, has booking section: ${html.includes('id="booking"')}`);
        } else {
          // No section/div with id="booking" — check for any element with that id
          const anyBookingEl = /<[a-z][^>]*\bid="booking"[^>]*>/i.exec(html);
          if (anyBookingEl) {
            console.log(`[Step6c] id="booking" on non-section/div element: ${anyBookingEl[0].slice(0,80)} — appending widget after it`);
            html = html.replace(anyBookingEl[0], anyBookingEl[0] + bookingWidgetHtml);
          } else {
            // No booking element at all — append before </body>
            html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
            console.log("[Step6c] Booking widget appended before </body> (no id=booking found)");
          }
        }
      } catch (e) {
        console.error("[Step6c] Booking widget injection failed:", e);
      }
      return html;
    });

    // ── STEP 7: Square shop ───────────────────────────────────────────────────
    const hasShopFeature = features.includes("Payments / Shop");
    const shopProducts: { name: string; price: string; photoUrl?: string }[] = productsWithPhotos.length > 0 ? productsWithPhotos : [];

    const finalHtmlWithShop = await step.run("step7-shop", async () => {
      if (!hasShopFeature || shopProducts.length === 0) return auditedHtml;
      let html = auditedHtml;
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

    // ── STEP 9: Save to Supabase ──────────────────────────────────────────────
    await step.run("step9-save", async () => {
      await saveJob(jobId, {
        ...job,
        html: finalHtmlWithShop,
        title: spec.projectTitle,
        fileName,
        domainSlug,
        vercelProjectName,
        status: "complete",
        previewUrl,
        builtAt: new Date().toISOString(),
      });

      if (clientSlug) {
        const existingClient = await getClient(clientSlug);
        if (existingClient) {
          await saveClient(clientSlug, { ...existingClient, preview_url: previewUrl });
        }
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
      const cssContent = extractCSS(finalHtmlWithShop);

      const featureChecklist = [
        { label: "Hero section", check: finalHtmlWithShop.includes('id="hero') || finalHtmlWithShop.includes('viewport') },
        { label: "Sticky nav + hamburger", check: finalHtmlWithShop.includes('id="hamburger"') },
        { label: "Testimonials section", check: finalHtmlWithShop.includes('id="testimonials"') },
        { label: "FAQ accordion", check: finalHtmlWithShop.includes('id="faq"') },
        { label: "Contact form", check: finalHtmlWithShop.includes('id="contact"') },
        { label: "Real email injected", check: finalHtmlWithShop.includes(clientEmail) },
        { label: "Real phone injected", check: finalHtmlWithShop.includes(clientPhone.replace(/\s/g, "")) || finalHtmlWithShop.includes(clientPhone) },
        { label: "Google Maps embedded", check: finalHtmlWithShop.includes("google.com/maps") },
        { label: "Booking widget", check: hasBookingFeature && (finalHtmlWithShop.includes("supersaas.com") || finalHtmlWithShop.includes("existingBookingUrl") || finalHtmlWithShop.includes('id="booking"')) },
        { label: "Footer with copyright", check: finalHtmlWithShop.includes("©") || finalHtmlWithShop.includes("&copy;") },
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
    ${previewUrl ? `<p style="margin:0 0 20px;"><a href="${previewUrl}" style="color:#00c896;font-size:15px;font-weight:600;">🌐 View Live Preview →</a></p>` : ""}
    <div style="margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;border-radius:8px;">${checklistHtml}</table>
    </div>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${releaseUrl}" style="background:#00c896;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📤 Release to Client</a></td>
      <td style="padding-right:8px;padding-bottom:8px;"><a href="${fixUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">🔧 Fix This Site</a></td>
      ${hasBookingFeature ? `<td style="padding-right:8px;padding-bottom:8px;"><a href="${unlockBookingUrl}" style="background:#f59e0b;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">📅 Unlock Booking</a></td>` : ""}
    </tr></table>
    <p style="margin:16px 0 0;"><a href="${adminUrl}" style="color:#475569;font-size:12px;">📊 Admin Dashboard</a></p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
        attachments: [
          { filename: `${fileName}-FINAL.html`, content: Buffer.from(finalHtmlWithShop).toString("base64") },
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

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports],
});
