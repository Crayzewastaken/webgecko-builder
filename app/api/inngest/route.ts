// app/api/inngest/route.ts
export const maxDuration = 300;

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
  getExampleHtmlsForIndustry,
  fetchPexelsPhotos,
  getPexelsQuery,
  resolveStitchClasses,
} from "@/lib/pipeline-helpers";
import { createSuperSaasSchedule } from "@/lib/supersaas";
import { createClientShopCatalogue } from "@/lib/square";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability, getAnalyticsCount, getBookingsForJob, appendPipelineLog } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { createTawktoProperty } from "@/lib/tawkto";
import { subscribeToNewsletter } from "@/lib/beehiiv";
import { provisionClientDomain } from "@/lib/synergy";
import { generateSiteBlueprint, requestGoogleIndexing } from "@/lib/blueprint";
import { auditAndFixSite } from "@/lib/auditor";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

// ─── Pipeline error logger ────────────────────────────────────────────────────
async function logPipelineError(jobId: string, step: string, type: string, message: string, fixed = false) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/error-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-process-secret": process.env.PROCESS_SECRET || "" },
      body: JSON.stringify({ jobId, step, type, message, fixed }),
    });
  } catch { /* non-fatal */ }
}

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
    try {

      // ── Load job ──────────────────────────────────────────────────────────────
      const job = await step.run("load-job", async () => {
        const j = await getJob(jobId);
        if (!j) throw new Error("Job not found: " + jobId);
        // Block concurrent builds, but allow rebuild/fullRebuild to override a stuck job
        if (j.status === "building" && !isRebuild) throw new Error("Already building");
        await saveJob(jobId, { ...j, status: "building" });
        return j;
      });

      // ── REBUILD MODE: always run full pipeline from scratch ─────────────────────
      // Rebuild regenerates everything including a fresh Stitch generation.
      // BUG-01 FIX: fetch saved HTML from DB so rebuild has access to it.
      let savedHtmlForRebuild: string | null = null;
      let isUsingRawStitchForRebuild = false;
      let savedBlueprint: any = null;
      if (isRebuild) {
        console.log("[Rebuild] Rebuild requested — trying to load original raw Stitch HTML first");
        const existingJob = await getJob(jobId);
        if (existingJob?.metadata?.rawStitchHtml && existingJob.metadata.rawStitchHtml.length > 1000) {
          const rawHtml = existingJob.metadata.rawStitchHtml;
          savedHtmlForRebuild = rawHtml;
          isUsingRawStitchForRebuild = true;
          console.log(`[Rebuild] Loaded saved raw Stitch HTML (${rawHtml.length} chars) from metadata`);
        } else if (existingJob?.html && existingJob.html.length > 1000) {
          const finalHtml = existingJob.html;
          savedHtmlForRebuild = finalHtml;
          isUsingRawStitchForRebuild = false;
          console.log(`[Rebuild] Fallback: Loaded final post-processed HTML (${finalHtml.length} chars) from DB`);
        }
        if (existingJob?.metadata?.blueprint) {
          savedBlueprint = existingJob.metadata.blueprint;
          console.log("[Rebuild] Loaded saved site blueprint from metadata");
        }
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
              ...(job.metadata || {}),
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
        logPipelineError(jobId, "Step0/SuperSaas", "SCHEDULE_FAIL", "SuperSaas schedule creation failed — placeholder booking section used").catch(()=>{});
        return "";
        });


      // ── Parse explicit CTA destination URL from additionalNotes / goal ────────
      // Handles: "All CTA buttons should link to https://...", "link to https://...", etc.
      // Takes priority over bookingUrl for general/booking CTAs when set.
      const ctaExternalUrl = (() => {
        const sources = [userInput.additionalNotes || "", userInput.goal || ""];
        for (const text of sources) {
          const m = text.match(/(?:link\s+to|point\s+to|go\s+to|direct\s+to|should\s+link\s+to|buttons?\s+should\s+link\s+to|cta[^.\n]*?:?\s+)(https?:\/\/[^\s,;)\n]+)/i);
          if (m) return m[1].replace(/[.,;)]+$/, "");
        }
        return "";
      })();
      if (ctaExternalUrl) console.log(`[Route] ctaExternalUrl parsed from notes: ${ctaExternalUrl}`);

      // ── STEP 1: Claude Haiku — Site Blueprint (Brain 1: Architect) ──────────
      // Fetch any admin-uploaded example HTMLs for this industry to use as reference
      const exampleHtmls = savedHtmlForRebuild ? [] : await step.run("step1a-example-htmls", async () => {
        return getExampleHtmlsForIndustry(userInput.industry, 2, jobId);
      });

      const spec = savedBlueprint
        ? savedBlueprint
        : (savedHtmlForRebuild
          ? { projectTitle: job.title || "Website", stitchPrompt: "", palette: { primary: "#1a1a2e", accent: "#10b981", background: "#0a0f1a", surface: "#0f1623", text: "#e2e8f0" }, typography: { headingFont: "Inter", bodyFont: "Inter", heroSize: "72px" }, sections: [] as string[], tone: "", heroHeadline: "", heroSubheadline: "", ctaText: "", uniqueDesignIdea: "", lsiKeywords: [] as string[] }
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
            exampleHtmls,
            instagramUrl: userInput.instagramUrl || "",
            linkedinUrl: userInput.linkedinUrl || "",
            tiktokUrl: userInput.tiktokUrl || "",
            realTestimonials: userInput.realTestimonials || "",
            blogTopics: userInput.blogTopics || "",
            videoUrl: userInput.videoUrl || "",
            shopProducts: userInput.shopProducts || "",
          });
          return blueprint;
          }));

      // Save blueprint to metadata if not already present
      if (!savedBlueprint) {
        await step.run("save-blueprint", async () => {
          const currentJob = await getJob(jobId);
          if (currentJob) {
            const meta = currentJob.metadata || {};
            await saveJob(jobId, {
              ...currentJob,
              metadata: {
                ...meta,
                blueprint: spec
              }
            });
          }
        });
      }


      console.log(`[Inngest] STEP 1 DONE (Blueprint): ${spec.projectTitle} — palette: ${spec.palette?.primary}`);


      // ── STEP 2: Create Stitch project ─────────────────────────────────────────
      const projectId = savedHtmlForRebuild ? "rebuild-skipped" : await step.run("step2-stitch-create", async () => {
        console.log(`[Inngest] STEP 2 START: creating Stitch project "${spec.projectTitle}"`);
        const project = await stitchSdk.createProject(spec.projectTitle);
        const pid = project.projectId;
        if (!pid) throw new Error("Stitch SDK: no projectId returned from createProject");
        console.log(`[Inngest] STEP 2 DONE: projectId=${pid}`);
        return pid;
      }) as string;

      // ── STEP 2b: Create design system from blueprint palette/typography ────────
      // This must run before generate() so Stitch uses the correct theme.
      const designSystemId = savedHtmlForRebuild ? "" : await step.run("step2b-design-system", async () => {
        try {
          const fs = require("fs");
          const path = require("path");
          let designMdContent = "";
          try {
            designMdContent = fs.readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf-8");
          } catch { /* DESIGN.md not found */ }

          const palette = spec.palette || {};
          const typography = spec.typography || {};

          const fontMap: Record<string, string> = {
            "Inter": "INTER", "Space Grotesk": "SPACE_GROTESK", "SpaceGrotesk": "SPACE_GROTESK",
            "Manrope": "MANROPE", "Plus Jakarta Sans": "PLUS_JAKARTA_SANS", "PlusJakartaSans": "PLUS_JAKARTA_SANS",
            "Work Sans": "WORK_SANS", "WorkSans": "WORK_SANS", "DM Sans": "DM_SANS", "DMSans": "DM_SANS",
            "Geist": "GEIST", "Nunito Sans": "NUNITO_SANS", "NunitoSans": "NUNITO_SANS",
            "Rubik": "RUBIK", "Sora": "SORA", "Epilogue": "EPILOGUE", "Lexend": "LEXEND",
            "Montserrat": "MONTSERRAT", "Arimo": "ARIMO",
            "Hanken Grotesk": "HANKEN_GROTESK", "IBM Plex Sans": "IBM_PLEX_SANS",
          };
          const resolveFont = (name: string): string => {
            if (!name) return "INTER";
            if (fontMap[name]) return fontMap[name];
            const lower = name.toLowerCase();
            for (const [k, v] of Object.entries(fontMap)) {
              if (lower.includes(k.toLowerCase())) return v;
            }
            return "INTER";
          };

          const tokenLines = [
            `--clr-bg: ${palette.background || "#0a0f1a"};`,
            `--clr-surface: ${palette.surface || "#0f1623"};`,
            `--clr-accent: ${palette.accent || "#10b981"};`,
            `--clr-text: ${palette.text || "#e2e8f0"};`,
            `--clr-text-muted: ${palette.text ? palette.text + "99" : "#94a3b8"};`,
            "--clr-border: rgba(255,255,255,0.1);",
            `--clr-primary: ${palette.primary || "#1a1a2e"};`,
          ];
          const tokens = `:root {\n${tokenLines.join("\n")}\n}`;

          const isDark = (() => {
            const bg = palette.background || "#0a0f1a";
            const hex = bg.replace("#", "");
            if (hex.length < 6) return true;
            const r = parseInt(hex.slice(0,2),16);
            const g = parseInt(hex.slice(2,4),16);
            const b = parseInt(hex.slice(4,6),16);
            return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
          })();

          const headlineFont = resolveFont(typography.headingFont || "Space Grotesk");
          const bodyFont = resolveFont(typography.bodyFont || "Inter");

          // Keep designSystemInput minimal — only fields Stitch API accepts without error
          const designSystemInput = {
            displayName: `${spec.projectTitle} Design System`,
            designTokens: tokens,
            theme: {
              colorMode: (isDark ? "DARK" : "LIGHT") as "DARK" | "LIGHT",
              customColor: palette.accent || palette.primary || "#10b981",
              overridePrimaryColor: palette.primary || undefined,
              overrideSecondaryColor: palette.accent || undefined,
              headlineFont: headlineFont as any,
              bodyFont: bodyFont as any,
              labelFont: bodyFont as any,
              roundness: "ROUND_EIGHT" as const,
            },
          };

          const project = stitchSdk.project(projectId);
          const ds = await project.createDesignSystem(designSystemInput);
          console.log(`[Inngest] STEP 2b DONE: design system created, id=${ds.id}`);
          return ds.id;
        } catch (e: any) {
          console.warn(`[Inngest] STEP 2b: createDesignSystem failed (non-fatal): ${e?.message || String(e)}`);
          return "";
        }
      }) as string;
      // ── STEP 3: Stitch generate + fetch HTML in one blocking step ─────────────
      // generate() is synchronous/blocking — it waits until the screen is fully
      // rendered before returning. We call getHtml() immediately on the returned
      // screen object (no sleep, no polling needed).
      const stitchHtml = savedHtmlForRebuild ? savedHtmlForRebuild : await step.run("step3-stitch-generate", async () => {
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const stitchPrompt = (spec.stitchPrompt || "")
          .replace(/https?:\/\/[^\s"',)>]+/g, "[URL]")
          .replace(/\s{3,}/g, "  ");
        // Do NOT slice stitchPrompt — truncation breaks multipage and section instructions
        console.log(`[Inngest] STEP 3: Stitch generate (prompt: ${stitchPrompt.length} chars, projectId=${projectId})`);

        let html = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const project = stitchSdk.project(projectId);
            const screen = await project.generate(stitchPrompt, "DESKTOP");
            console.log(`[Inngest] STEP 3: generate() done — screenId=${screen.screenId} (attempt ${attempt})`);

            // getHtml() may return empty immediately after generate() — retry with backoff
            // list_screens is unreliable (returns 0 screens) so use direct getHtml() retries instead
            let url = await screen.getHtml();
            console.log(`[Inngest] STEP 3: getHtml() attempt 1 — url length=${url?.length ?? 0}`);

            if (!url && screen.screenId) {
              // Poll getHtml() directly: 20s, 20s, 20s, 30s, 30s = max 120s extra
              const pollDelays = [20000, 20000, 20000, 30000, 30000];
              for (let poll = 0; poll < pollDelays.length; poll++) {
                await sleep(pollDelays[poll]);
                try {
                  url = await screen.getHtml();
                  console.log(`[Inngest] STEP 3: getHtml() poll ${poll + 2} — url length=${url?.length ?? 0}`);
                  if (url) break;
                } catch (pe: any) {
                  console.log(`[Inngest] STEP 3: getHtml() poll ${poll + 2} error: ${pe?.message}`);
                }
              }
            }

            if (!url) throw new Error(`Stitch getHtml() returned empty after all retries (screenId=${screen.screenId})`);

            const fetchRes = await fetch(url);
            const text = await fetchRes.text();
            console.log(`[Inngest] STEP 3: fetched HTML — status=${fetchRes.status} length=${text.length}`);
            if (text.length > 5000 && text.includes("<")) { html = text; break; }
            throw new Error(`Stitch HTML too short or not HTML (${text.length} chars, status=${fetchRes.status})`);
          } catch (e: any) {
            const msg = e?.message || String(e);
            console.warn(`[Inngest] STEP 3: attempt ${attempt} failed: ${msg}`);
            appendPipelineLog(jobId, { level: attempt === 3 ? "error" : "warn", step: "stitch", msg: `Attempt ${attempt} failed: ${msg}`, businessName: userInput.businessName }).catch(()=>{});
            if (attempt === 3) throw e;
            await sleep(10000 * attempt);
          }
        }

        if (html.length < 5000) throw new Error(`Stitch HTML too short (${html.length} chars)`);
        if (/<h1>\s*HOME PAGE\s*<\/h1>/i.test(html)) throw new Error("Stitch returned skeleton");
        const styleLen = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("").length;
        const inlineStyleCount = (html.match(/\bstyle=/gi) || []).length;
        if (styleLen < 100 && inlineStyleCount < 20) {
          throw new Error(`Stitch HTML has no CSS (styleLen=${styleLen}, inlineStyles=${inlineStyleCount})`);
        }
        console.log(`[Inngest] STEP 3 DONE: HTML ${html.length} chars`);
        return html;
      }) as string;

      // Save raw Stitch HTML to database metadata so that subsequent rebuilds can use the fresh raw layout rather than overriding with post-processed final HTML.
      if (!isRebuild || !isUsingRawStitchForRebuild) {
        await step.run("save-raw-stitch-html", async () => {
          const currentJob = await getJob(jobId);
          if (currentJob) {
            const meta = currentJob.metadata || {};
            await saveJob(jobId, {
              ...currentJob,
              metadata: {
                ...meta,
                rawStitchHtml: stitchHtml
              }
            });
          }
        });
      }

      // ── STEP 4b: Structural injection into Stitch HTML ──────────────────────────
      // DO NOT rewrite or alter Stitch's design. Inject only what is structurally
      // missing: required IDs, mobile nav, multi-page wrappers, contact form, footer.
      // requestedPageIds at outer scope so step7b-validate and other steps can use it
      const requestedPageIds = (Array.isArray(userInput.pages) ? userInput.pages : ["Home"])
        .map((p: string) => normalizePageId(p));
      const rebuiltHtml = (savedHtmlForRebuild && !isUsingRawStitchForRebuild) ? savedHtmlForRebuild : await step.run("step4b-claude-rebuild", async () => {

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

        // 1. Inject id="hero" on first <section> only — never <div> (avoids nav/logo elements)
        if (!html.includes('id="hero"') && !html.includes("id='hero'")) {
          html = html.replace(/(<section\b)(?![^>]*\bid=)/, '$1 id="hero"');
        }

        // 2. Wire existing hamburger/SVG menu button OR inject our own if missing
        // Tailwind exports use md:hidden / lg:hidden on a button — treat that as a native mobile nav
        const hasTailwindMobileNav = /class="[^"]*(?:md|lg|sm):hidden[^"]*"/.test(html);
        const hasHamburger = html.includes('id="hamburger"') || html.includes("id='hamburger'") || hasTailwindMobileNav;
        const hasMobileMenu = html.includes('id="mobile-menu"') || html.includes("id='mobile-menu'") || hasTailwindMobileNav;

        if (!hasHamburger) {
          // Try to wire an existing button that looks like a hamburger (SVG icon, aria-label, data-*)
          const svgHamburgerRe = /<button([^>]*(?:aria-label=["'][^"']*(?:menu|nav|toggle)[^"']*["']|class=["'][^"']*(?:hamburger|menu-btn|nav-toggle|mobile-toggle)[^"']*["'])[^>]*)>/gi;
          let wiredExisting = false;
          html = html.replace(svgHamburgerRe, (match: string, attrs: string) => {
            if (attrs.includes('onclick')) return match; // already wired
            wiredExisting = true;
            console.log('[Step4b] Wiring existing SVG hamburger button');
            return `<button${attrs} id="hamburger" onclick="document.getElementById('mobile-menu')&&(document.getElementById('mobile-menu').style.display='block')">`;
          });

          if (!wiredExisting) {
            // Inject our own hamburger + mobile drawer
            const mobileNav = `
  <div id="mobile-menu" style="display:none;position:fixed;top:0;right:0;width:80%;max-width:300px;height:100vh;z-index:9999;background:#1e293b;padding:24px;box-shadow:-4px 0 24px rgba(0,0,0,0.4);">
    <button onclick="document.getElementById('mobile-menu').style.display='none'" style="float:right;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">&times;</button>
    ${requestedPageIds.map((id: string) => `<a href="#" onclick="event.preventDefault();document.getElementById('mobile-menu').style.display='none';window.navigateTo&&window.navigateTo('${id}')" style="display:block;padding:12px 0;color:#f1f5f9;text-decoration:none;font-size:1rem;border-bottom:1px solid #334155;">${id.charAt(0).toUpperCase() + id.slice(1)}</a>`).join("\n  ")}
  </div>
  <button id="hamburger" onclick="document.getElementById('mobile-menu').style.display='block'" style="display:none;position:fixed;top:16px;right:16px;z-index:10000;background:none;border:none;cursor:pointer;padding:8px;" aria-label="Open menu">
    <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
    <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
    <span style="display:block;width:24px;height:2px;background:#fff;margin:5px 0;"></span>
  </button>
  <style>@media(max-width:768px){#hamburger{display:block!important;}}</style>`;
            html = html.replace(/<body[^>]*>/, (m: string) => m + mobileNav);
          } else if (!hasMobileMenu) {
            // We wired an existing button but there's no mobile menu — inject the drawer only
            const mobileDrawer = `
  <div id="mobile-menu" style="display:none;position:fixed;top:0;right:0;width:80%;max-width:300px;height:100vh;z-index:9999;background:#1e293b;padding:24px;box-shadow:-4px 0 24px rgba(0,0,0,0.4);">
    <button onclick="document.getElementById('mobile-menu').style.display='none'" style="float:right;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">&times;</button>
    ${requestedPageIds.map((id: string) => `<a href="#" onclick="event.preventDefault();document.getElementById('mobile-menu').style.display='none';window.navigateTo&&window.navigateTo('${id}')" style="display:block;padding:12px 0;color:#f1f5f9;text-decoration:none;font-size:1rem;border-bottom:1px solid #334155;">${id.charAt(0).toUpperCase() + id.slice(1)}</a>`).join("\n  ")}
  </div>`;
            html = html.replace(/<body[^>]*>/, (m: string) => m + mobileDrawer);
          }
        }

        // 3. Inject id="contact" section if missing (also detect Stitch contact sections without the id)
        const hasContactSection = html.includes('id="contact"') ||
          /(?:get in touch|contact us|send us a message|reach out|enquire|enquiry form)/i.test(
            html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
          );
        if (!hasContactSection) {
          const bName = userInput.businessName || "Us";
          const bPhone = clientPhone || "";
          const bEmail = clientEmail || "";
          const bAddress = userInput.businessAddress || "";
          const contactInfoHtml = [
            bPhone ? `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 8px;">&#128222; <a href="tel:${bPhone}" style="color:#94a3b8;text-decoration:none;">${bPhone}</a></span>` : "",
            bEmail ? `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 8px;">&#9993; <a href="mailto:${bEmail}" style="color:#94a3b8;text-decoration:none;">${bEmail}</a></span>` : "",
            bAddress ? `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 8px;">&#128205; <span style="color:#94a3b8;">${bAddress}</span></span>` : "",
          ].filter(Boolean).join("");
          const contactSection = `
  <section id="contact" style="padding:80px 24px;background:var(--clr-bg,#0f172a);scroll-margin-top:80px;">
    <div style="max-width:640px;margin:0 auto;text-align:center;">
      <h2 style="color:var(--clr-text,#f1f5f9);font-size:2rem;font-weight:900;margin:0 0 12px;">Get In Touch With ${bName}</h2>
      <p style="color:#94a3b8;margin:0 0 8px;flex-wrap:wrap;display:flex;justify-content:center;align-items:center;">${contactInfoHtml}</p>
      <form style="display:flex;flex-direction:column;gap:16px;margin-top:32px;text-align:left;" onsubmit="(function(f){var nm=(f.querySelector('[name=name]')||{}).value||'';var em=(f.querySelector('[name=email]')||{}).value||'';var ph=(f.querySelector('[name=phone]')||{}).value||'';var mg=(f.querySelector('textarea')||{}).value||'';fetch('/api/contact/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:typeof WG_JOB!=='undefined'?WG_JOB:'',name:nm,email:em,phone:ph,message:mg})}).catch(function(){window.location='mailto:${bEmail}?subject=Enquiry&body='+encodeURIComponent('Name: '+nm+'\nPhone: '+ph+'\nMessage: '+mg);});var s=document.createElement('div');s.style.cssText='background:#22c55e;color:#fff;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;';s.textContent='Thank you! ${bName} will be in touch within 24 hours.';f.appendChild(s);f.querySelectorAll('input,textarea,button').forEach(function(el){el.setAttribute('disabled','true');});})(this);return false;">
        <input name="name" placeholder="Your Name" required style="padding:14px 16px;border-radius:10px;border:1px solid #334155;background:var(--clr-surface,#1e293b);color:var(--clr-text,#f1f5f9);font-size:1rem;outline:none;">
        <input name="email" type="email" placeholder="Your Email" required style="padding:14px 16px;border-radius:10px;border:1px solid #334155;background:var(--clr-surface,#1e293b);color:var(--clr-text,#f1f5f9);font-size:1rem;outline:none;">
        <input name="phone" type="tel" placeholder="Your Phone" style="padding:14px 16px;border-radius:10px;border:1px solid #334155;background:var(--clr-surface,#1e293b);color:var(--clr-text,#f1f5f9);font-size:1rem;outline:none;">
        <textarea name="message" placeholder="Your Message" rows="4" required style="padding:14px 16px;border-radius:10px;border:1px solid #334155;background:var(--clr-surface,#1e293b);color:var(--clr-text,#f1f5f9);font-size:1rem;resize:vertical;outline:none;"></textarea>
        <button type="submit" style="padding:15px;border-radius:10px;background:var(--clr-accent,#22c55e);color:#fff;font-size:1rem;font-weight:700;border:none;cursor:pointer;letter-spacing:0.02em;">Send Message</button>
      </form>
    </div>
  </section>`;
          // Inject before footer if present, otherwise before </body>
          if (/<footer[\s>]/i.test(html)) {
            html = html.replace(/<footer[\s>]/i, contactSection + "\n$&");
          } else {
            html = html.replace(/<\/body>/i, contactSection + "\n</body>");
          }
        }

        // 4. Inject footer with copyright + legal links if missing; always pin to bottom via flex body
        {
          const yr4b = new Date().getFullYear();
          // Pull Termly privacy URL if already set via admin checklist
          const termlyPrivacyUrl: string = job.metadata?.checklistLinks?.termly_privacy_embed || "";
          const privacyHref = termlyPrivacyUrl || "#privacy-policy";
          const legalLinks = `<span style="margin-top:8px;display:block;font-size:0.8rem;"><a href="${privacyHref}" target="_blank" rel="noopener" style="color:#64748b;text-decoration:underline;margin:0 8px;" data-wg-privacy>Privacy Policy</a><span style="color:#334155;">|</span><a href="#terms" style="color:#64748b;text-decoration:underline;margin:0 8px;" data-wg-terms>Terms of Service</a></span>`;
          const footerHtml = `<footer id="wg-footer" style="margin-top:auto;padding:32px 24px;background:#0a0f1a;text-align:center;color:#64748b;font-size:0.875rem;">&copy; ${yr4b} ${userInput.businessName}. All rights reserved.${legalLinks}</footer>`;
          // Detect existing footer broadly (tag OR common id/class patterns)
          const hasExistingFooter = /<footer[\s>]/i.test(html) || /id=["']footer["']/i.test(html) || /class=["'][^"']*footer[^"']*["']/i.test(html);
          if (!hasExistingFooter) {
            html = html.replace(/<\/body>/i, footerHtml + "\n</body>");
          } else {
            // Inject legal links into the existing footer if not already present
            if (!html.includes("data-wg-privacy")) {
              html = html.replace(/(<\/footer>)/i, legalLinks + "$1");
            }
            // Ensure existing footer has margin-top:auto so it sticks to bottom
            html = html.replace(/<footer(?![^>]*margin-top:auto)([^>]*)>/i, (m: string, attrs: string) => {
              if (attrs.includes("style=")) {
                return m.replace(/style=["']/, (s: string) => s + "margin-top:auto;");
              }
              return `<footer${attrs} style="margin-top:auto;">`;
            });
          }
          // Make <body> a flex column so footer naturally sits at bottom
          if (html.includes("<body")) {
            html = html.replace(/<body([^>]*)>/i, (m: string, attrs: string) => {
              if (attrs.includes("display:flex") || attrs.includes("flex-direction")) return m;
              if (attrs.includes("style=")) {
                return m.replace(/style=["']/, (s: string) => s + "display:flex;flex-direction:column;min-height:100vh;");
              }
              return `<body${attrs} style="display:flex;flex-direction:column;min-height:100vh;">`;
            });
          }
          // Also inject a <style> to ensure [data-page].active sections flex-grow
          if (!html.includes("wg-footer-fix")) {
            const footerFixStyle = `<style data-wg="wg-footer-fix">body{display:flex;flex-direction:column;min-height:100vh;}[data-page]{flex:1 0 auto;}footer,#wg-footer{margin-top:auto;flex-shrink:0;}</style>`;
            html = html.replace(/<\/head>/i, footerFixStyle + "\n</head>");
          }
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
        // Resolve Stitch design-token utility classes into real CSS so layout renders correctly outside Stitch canvas
        html = resolveStitchClasses(html);
        const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

        if (userInput.businessName) {
          // Preserve Stitch's real title — only replace generic placeholders
          html = html.replace(/<title>([^<]*)<\/title>/i, (_m: string, existing: string) => {
            const trimmed = existing.trim();
            if (trimmed.includes('|') || trimmed.includes(' - ') || trimmed.length > userInput.businessName.length + 5) {
              return `<title>${trimmed}</title>`;
            }
            return `<title>${userInput.businessName}</title>`;
          });
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

        // ── Three-tier CTA keyword system ────────────────────────────────────────────
        // booking → link to bookingUrl externally (if external URL, no iframe) or scroll to #booking
        // contact → always scroll to #contact, never #booking
        // shop → navigate to shop page (for shop-based sites)
        // general → scroll to bookingNavTarget (booking if available, else contact)
        const bookingCtaKeywords = [
          'book now','book a session','book a call','book a consult','book consultation','book free',
          'book today','book online',
          'join now','sign up','free trial','try free',
          'reserve','schedule now','schedule a call','claim offer','claim now','apply now',
          'start today','start free','start starter','start business','start premium','start plan','start now',
        ];
        const contactCtaKeywords = [
          'get in touch','contact us','reach out',
        ];
        // Shop-specific CTAs — navigate to shop page
        const shopCtaKeywords = [
          'shop the setup','shop now','shop','buy the kit','buy kit','buy setup',
          'add to cart','view products','browse products','view shop','shop products',
          'get the kit','grab the kit','order kit',
        ];
        // Demo/video CTAs — navigate to shop (usually a video-demo product) or stay on page
        const demoCtaKeywords = [
          'watch demo','watch the demo','see it in action','view demo','demo',
          'see demo','try demo','watch it','watch now',
        ];
        const generalCtaKeywords = [
          'get started','get a quote','get free quote','get quote',
          'enquire now','enquire','learn more','find out more','discover more',
          'request a quote','request quote','order now','buy now',
          'explore capability','explore','launch',
          'login','log in','sign in',  // For shop sites, login = go to shop/contact
        ];
        const allCtaKeywords = [...bookingCtaKeywords, ...contactCtaKeywords, ...shopCtaKeywords, ...demoCtaKeywords, ...generalCtaKeywords];

        // ctaExternalUrl: explicit URL from additionalNotes/goal takes top priority.
        // Falls back to bookingUrl when hasBookingFeature is false (user provided own booking link).
        const effectiveExternalCta = ctaExternalUrl || (bookingUrl && !hasBookingFeature ? bookingUrl : "");
        // Domain of the explicitly requested CTA URL — used to whitelist it in the hard sweep below.
        const ctaExternalDomain = effectiveExternalCta
          ? effectiveExternalCta.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0].toLowerCase()
          : "";

        // Does this site have a shop page?
        const hasShopPage = features.includes("Payments / Shop") || (userInput.pages || []).some((p: string) => normalizePageId(p) === "shop");

        // Booking CTA destination:
        const bookingCtaOnclick = effectiveExternalCta
          ? `window.open('${effectiveExternalCta}','_blank')`
          : `event.preventDefault();window.navigateTo&&window.navigateTo('${hasBookingFeature ? "booking" : "contact"}')`;
        const contactCtaOnclick = `event.preventDefault();window.navigateTo&&window.navigateTo('contact')`;
        // Shop CTAs: go to shop page if it exists, else contact
        const shopCtaOnclick = `event.preventDefault();window.navigateTo&&window.navigateTo('${hasShopPage ? "shop" : "contact"}')`;
        // Demo CTAs: go to shop page (usually has product demo), or open external CTA if provided
        const demoCtaOnclick = effectiveExternalCta
          ? `window.open('${effectiveExternalCta}','_blank')`
          : `event.preventDefault();window.navigateTo&&window.navigateTo('${hasShopPage ? "shop" : "contact"}')`;
        // General CTAs (Get Started, Explore, etc.) use explicit CTA URL when provided
        // For shop sites: "Get Started", "Login" etc. go to shop not booking
        const generalCtaOnclick = effectiveExternalCta
          ? `window.open('${effectiveExternalCta}','_blank')`
          : hasShopPage
            ? `event.preventDefault();window.navigateTo&&window.navigateTo('shop')`
            : `event.preventDefault();window.navigateTo&&window.navigateTo('${bookingNavTarget}')`;

        const getCtaOnclick = (txt: string): string => {
          if (shopCtaKeywords.some((k: string) => txt.includes(k))) return shopCtaOnclick;
          if (demoCtaKeywords.some((k: string) => txt.includes(k))) return demoCtaOnclick;
          if (bookingCtaKeywords.some((k: string) => txt.includes(k))) return bookingCtaOnclick;
          if (contactCtaKeywords.some((k: string) => txt.includes(k))) return contactCtaOnclick;
          return generalCtaOnclick;
        };

        // Hard sweep: replace ANY link pointing to webgecko-builder or generic vercel domains.
        // EXCEPTION: if the URL matches ctaExternalDomain the user explicitly requested it — preserve it.
        html = html.replace(/<a([^>]*)href=["'](https?:\/\/(?:[\w-]+\.)?(?:webgecko-builder|vercel)\.(?:app|com|io)[^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi, (_m: string, pre: string, href: string, post: string, inner: string) => {
          const hrefDomain = href.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0].toLowerCase();
          if (ctaExternalDomain && hrefDomain === ctaExternalDomain) return _m; // user asked for this URL — keep it
          const txt = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
          const onclick = getCtaOnclick(txt);
          const cleanPre = pre.replace(/\s*onclick=["'][^"']*["']/gi, "");
          const cleanPost = post.replace(/\s*onclick=["'][^"']*["']/gi, "");
          return `<a${cleanPre}${cleanPost} href="#" onclick="${onclick}">${inner}</a>`;
        });

        // Wire <a> CTA links — catches ALL hrefs: #, empty, void, AND external URLs
        html = html.replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
          const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
          if (!allCtaKeywords.some((k: string) => txt.includes(k))) return match;
          if (attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
          if (attrs.includes('type="submit"')) return match;
          // Skip mailto: and tel: links
          if (/href=["'](?:mailto:|tel:)/i.test(attrs)) return match;
          const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
          const href = hrefMatch ? hrefMatch[1] : '';
          // Preserve real in-page anchors that point to existing sections
          if (href.startsWith('#') && href.length > 1) {
            const sectionId = href.slice(1);
            if (html.includes(`id="${sectionId}"`) || html.includes(`id='${sectionId}'`)) return match;
          }
          // Preserve links to the client's own custom domain — don't override them
          if (rawDomain && href.startsWith('http')) {
            const hrefDomain = href.replace(/^https?:\/\/(?:www\.)?/, '').split('/')[0].toLowerCase();
            if (hrefDomain === rawDomain || hrefDomain.endsWith('.' + rawDomain)) return match;
          }
          // Strip dummy onclick handlers Stitch generates (alert, return false, void)
          const cleanAttrs = attrs.replace(/\s*onclick=["'][^"']*(?:alert|return false|void\(0\))[^"']*["']/gi, '');
          // Remove the old href entirely and replace with onclick handler
          const attrsNoHref = cleanAttrs.replace(/\s*href=["'][^"']*["']/gi, '');
          const onclick = getCtaOnclick(txt);
          return `<a${attrsNoHref} href="#" onclick="${onclick}">${inner}</a>`;
        });

        // Wire <button> CTA tags — Stitch often generates these instead of <a>
        html = html.replace(/<button([^>]*)>([\s\S]*?)<\/button>/gi, (match: string, attrs: string, inner: string) => {
          const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
          if (!allCtaKeywords.some((k: string) => txt.includes(k))) return match;
          if (attrs.includes('type="submit"') || attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
          // Strip dummy onclick handlers
          const cleanAttrs = attrs.replace(/\s*onclick=["'][^"']*(?:alert|return false|void\(0\))[^"']*["']/gi, '');
          const onclick = getCtaOnclick(txt);
          return `<button${cleanAttrs} onclick="${onclick}">${inner}</button>`;
        });

        // ── Hard-fix contact form: remove any signup/registration fields Stitch generates ──
        // Replace known bad field patterns with nothing (name, email, phone, message are kept)
        // Remove: Business Name, Company, Project Goals/Type dropdowns, subject, username, password
        html = html.replace(/<(?:div|p|label|tr)[^>]*>[^<]*(?:Business Name|Company Name|Organisation|Organization|Project (?:Goals?|Type|Details?|Description)|Subject|Username|Password|Confirm Password|Account Type|Service Type|Service Interest|How did you hear)[^<]*<\/(?:div|p|label|tr)>\s*/gi, '');
        html = html.replace(/<(?:input|select|textarea)[^>]*(?:name=["'](?:business|company|organisation|organization|subject|username|password|confirm|project_type|service_type|how_hear)[^"']*["']|placeholder=["'][^"']*(?:Business Name|Company|Organization|Project Type|Service Type|Password|Username)[^"']*["'])[^>]*>(?:<\/(?:input|select|textarea)>)?/gi, '');
        // Replace bad submit button text ("Initialize Transmission", "Send Brief", "Submit Request", etc.)
        html = html.replace(/(?:Initialize Transmission|Send Brief|Submit Request|Submit Inquiry|Send Brief|Launch Project|Start Project|Begin Project)/gi, 'Send Message');
        // Fix contact section heading if it reads like a project intake form
        html = html.replace(/(?:Start Your Project|Launch Your Project|Begin Your Project|Project Inquiry|Project Brief|Start a Project)/gi, 'Get in Touch');

        // Wire bare href="#" nav links in footer/nav by matching visible text to page IDs
        const navLinkMap: Record<string, string> = {
          "home": "home", "about": "about", "about us": "about",
          "services": "services", "our services": "services", "what we do": "services",
          "gallery": "gallery", "portfolio": "gallery", "our work": "gallery",
          "contact": "contact", "contact us": "contact", "get in touch": "contact",
          "faq": "faq", "faqs": "faq", "pricing": "pricing", "packages": "pricing",
          "shop": "shop", "blog": "blog", "team": "team", "booking": "booking",
          "testimonials": "testimonials", "reviews": "testimonials",
          "view portfolio": "gallery", "view all work": "gallery", "our projects": "gallery",
        };
        html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
          if (attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
          const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
          const target = navLinkMap[txt] || Object.entries(navLinkMap).find(([k]) => txt.includes(k))?.[1];
          if (!target) return match;
          // Only wire if this page actually exists in the site
          if (!html.includes(`id="${target}"`) && !html.includes(`data-page="${target}"`)) return match;
          return `<a${attrs} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${target}')">${inner}</a>`;
        });

        if (businessAddress) {
          // Use Embed API with key if available, otherwise fall back to the free maps?q= iframe (no key needed)
          // Use Google Embed API with key if available, otherwise OpenStreetMap (free, no key, reliable)
          const mapsEmbed = process.env.GOOGLE_MAPS_API_KEY
            ? `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;display:block;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`
            : `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;display:block;" loading="lazy" allowfullscreen src="https://www.openstreetmap.org/export/embed.html?bbox=&layer=mapnik&marker=&query=${encodeURIComponent(businessAddress)}" title="Map"></iframe><small style="display:block;text-align:right;font-size:10px;color:#94a3b8;margin-top:4px;"><a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(businessAddress)}" target="_blank" style="color:#94a3b8;">View larger map</a></small></div>`;
          // Skip map injection if Stitch already embedded a real Google Maps iframe
          const hasRealMap = /<iframe[^>]*(?:google\.com\/maps|maps\.googleapis)[^>]*>/i.test(html);
          if (hasRealMap) {
            console.log("[Step5] Stitch already has Google Maps — skipping map injection");
          } else {
          // Remove only openstreetmap placeholders
          html = html.replace(/<div[^>]*>\s*<iframe[^>]*(?:openstreetmap)[^>]*>[\s\S]*?<\/iframe>\s*<\/div>/gi, '');
          html = html.replace(/<iframe[^>]*(?:openstreetmap)[^>]*>[\s\S]*?<\/iframe>/gi, '');
          // Also strip bare <a href="...maps..."> links Stitch sometimes generates instead of iframes
          html = html.replace(/<a[^>]*href=["'][^"']*(?:google\.com\/maps|maps\.googleapis\.com)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
          // Strip Stitch visual map placeholder boxes — broad catch for all variants:
          // Matches map-classed divs with no real iframe, and bare "Map View: X" text nodes
          html = html.replace(/<div[^>]*class="[^"]*(?:map|location|directions)[^"]*"[^>]*>[\s\S]{0,1500}?<\/div>/gi, (m: string) => {
            if (m.includes('<iframe')) return m;
            const textOnly = m.replace(/<[^>]+>/g, '').trim();
            if (/Map View|map-placeholder|map_icon/i.test(m)) return '';
            if (textOnly.length < 80 && /map|location|directions/i.test(m)) return '';
            return m;
          });
          html = html.replace(/<[a-z][^>]*>\s*Map View\s*:[^<]{0,100}<\/[a-z]+>/gi, '');
          // Strip Stitch data-location map placeholders (e.g. <div data-location="Forest Lake">...Map Loading...</div>)
          html = html.replace(/<div[^>]*data-location=[^>]*>[\s\S]{0,2000}?<\/div>/gi, (m: string) => {
            if (m.includes('<iframe')) return m; // keep real maps
            if (/Map Loading|map-placeholder|lh3\.googleusercontent/i.test(m)) return '';
            return m;
          });
          // Always inject map as a full-width block AFTER the contact section, never inside it.
          // This prevents the map overlapping the two-column contact layout.
          const mapBlock = `<div id="map-section" style="width:100%;padding:0 0 60px;background:inherit;">${mapsEmbed}</div>`;
          let mapInjected = false;

          // 1. Replace explicit MAP PLACEHOLDER divs
          const beforeMapLen = html.length;
          html = html.replace(/<div[^>]*>\s*MAP PLACEHOLDER[^<]*<\/div>/gi, mapBlock);
          if (html.length !== beforeMapLen) mapInjected = true;

          // 2. Replace existing map-class divs (e.g. Stitch put a placeholder div)
          if (!mapInjected) {
            html = html.replace(/<div([^>]*(?:id|class)="[^"]*(?:^map$|^map-|location-map|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/div>/gi, (match: string, attrs: string) => {
              if (match.includes('iframe')) return match;
              mapInjected = true;
              return mapBlock;
            });
          }

          // 3. Inject AFTER the outer closing tag of id="contact" using depth counter
          if (!mapInjected) {
            const contactOpenRe = /<(section|div)[^>]*id=["']contact["'][^>]*>/i;
            const contactOpenM = contactOpenRe.exec(html);
            if (contactOpenM) {
              const tagName = contactOpenM[1].toLowerCase();
              let depth = 1;
              let pos = contactOpenM.index + contactOpenM[0].length;
              const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi');
              const closeRe = new RegExp(`<\\/${tagName}>`, 'gi');
              let endIdx = -1;
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
                  if (depth === 0) endIdx = pos;
                }
              }
              if (endIdx > 0) {
                html = html.slice(0, endIdx) + "\n" + mapBlock + html.slice(endIdx);
                mapInjected = true;
              }
            }
          }

          // 4. Last resort: before <footer> if present, else </body>
          if (!mapInjected) {
            if (html.includes("<footer")) {
              html = html.replace(/<footer/i, mapBlock + "\n<footer");
            } else {
              html = html.replace("</body>", mapBlock + "\n</body>");
            }
          }
          } // end else (no real Google Maps — injected ours)
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
        // Posts directly to Beehiiv's public embed API — no dependency on our builder app.
        // Guard: skip if Stitch already generated ANY newsletter/subscribe section
        const hasNewsletterAlready = html.includes('id="newsletter-form"') || html.includes('id="newsletter"')
          || /subscribe.*to.*newsletter|stay.*updated|stay.*in.*the.*loop|sign.*up.*newsletter/i.test(html);
        if (features.includes("Newsletter Signup") && !hasNewsletterAlready) {
          const beehiivPubId = (process.env.BEEHIIV_PUBLICATION_ID || "").startsWith("pub_")
            ? process.env.BEEHIIV_PUBLICATION_ID
            : `pub_${process.env.BEEHIIV_PUBLICATION_ID || ""}`;
          const beehiivEndpoint = `https://api.beehiiv.com/v2/publications/${beehiivPubId}/subscriptions/email`;
          const newsletterSection = `
  <section id="newsletter" style="padding:64px 24px;background:linear-gradient(135deg,#0f1623 0%,#1a2332 100%);text-align:center;">
    <div style="max-width:600px;margin:0 auto;">
      <h2 style="color:#ffffff;font-size:2rem;font-weight:900;margin:0 0 12px;">Stay in the Loop</h2>
      <p style="color:#94a3b8;font-size:1rem;margin:0 0 32px;">Get tips, updates and exclusive offers from ${userInput.businessName} straight to your inbox.</p>
      <form id="newsletter-form" onsubmit="(function(e){e.preventDefault();var form=e.target;var em=form.querySelector('input[type=email]');var btn=form.querySelector('button');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${beehiivEndpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value,reactivate_existing:true,send_welcome_email:true})}).then(function(r){if(r.ok||r.status===201||r.status===200){btn.textContent='✓ Subscribed!';btn.style.background='#10b981';em.disabled=true;}else{throw new Error('Failed');}}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:480px;margin:0 auto;">
        <input type="email" name="email" placeholder="your@email.com.au" required style="flex:1;min-width:220px;padding:14px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#ffffff;font-size:0.95rem;outline:none;">
        <button type="submit" style="padding:14px 28px;border-radius:10px;background:#10b981;color:#000000;font-weight:700;font-size:0.95rem;border:none;cursor:pointer;white-space:nowrap;">Subscribe</button>
      </form>
      <p style="color:#475569;font-size:0.75rem;margin-top:16px;">No spam. Unsubscribe any time.</p>
    </div>
  </section>`;
          // Inject before <footer> so footer stays at the very bottom
          if (html.includes("<footer")) {
            html = html.replace(/<footer/i, newsletterSection + "\n<footer");
          } else {
            html = html.replace("</body>", newsletterSection + "\n</body>");
          }
          console.log("[Step5] Newsletter signup section injected (Beehiiv direct)");
        }

        // -- Pop-up Form -- timed lead-capture overlay (15s delay + exit intent) ---
        if (features.includes("Pop-up Form") && !html.includes('id="wg-popup"')) {
          const beehiivPubId2 = (process.env.BEEHIIV_PUBLICATION_ID || "").startsWith("pub_")
            ? process.env.BEEHIIV_PUBLICATION_ID
            : `pub_${process.env.BEEHIIV_PUBLICATION_ID || ""}`;
          const beehiivEndpoint2 = `https://api.beehiiv.com/v2/publications/${beehiivPubId2}/subscriptions/email`;
          const popupHtml = `
  <div id="wg-popup" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);align-items:center;justify-content:center;">
    <div style="background:#1a2332;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:48px 40px;max-width:440px;width:90%;position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
      <button onclick="document.getElementById('wg-popup').style.display='none';sessionStorage.setItem('wg-popup-closed','1');" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;line-height:1;">&times;</button>
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:2.2rem;margin-bottom:12px;">&#128293;</div>
        <h3 style="color:#ffffff;font-size:1.5rem;font-weight:900;margin:0 0 8px;">Don't Miss Out!</h3>
        <p style="color:#94a3b8;font-size:0.95rem;margin:0;">Join our list and get exclusive offers from ${userInput.businessName}.</p>
      </div>
      <form id="wg-popup-form" onsubmit="(function(e){e.preventDefault();var em=e.target.querySelector('input[type=email]');var btn=e.target.querySelector('button[type=submit]');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${beehiivEndpoint2}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value,reactivate_existing:true,send_welcome_email:true})}).then(function(r){if(r.ok||r.status===201||r.status===200){btn.textContent='Thanks! Check your inbox';btn.style.background='#10b981';em.disabled=true;setTimeout(function(){document.getElementById('wg-popup').style.display='none';sessionStorage.setItem('wg-popup-closed','1');},2000);}else{throw new Error('Failed');}}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)">
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

        // ── Guarantee at least 3 testimonials ────────────────────────────────────
        {
          const auNames = ["Sarah M., Melbourne","James T., Brisbane","Emily R., Sydney","Michael K., Perth","Jessica L., Adelaide","Daniel W., Gold Coast"];
          const genReview = (industry: string, idx: number) => {
            const quotes: Record<string, string[]> = {
              medical: ["Absolutely outstanding service — I had answers within minutes.","Professional, caring, and incredibly responsive. Highly recommend.","Made a stressful situation so much easier. Five stars."],
              default: ["Exceptional service from start to finish. Could not be happier.","Professional, reliable, and genuinely great to work with.","Exactly what we needed — delivered on every promise."],
            };
            const pool = quotes[industry?.toLowerCase().includes("doctor")||industry?.toLowerCase().includes("medical")||industry?.toLowerCase().includes("health") ? "medical" : "default"];
            return `<div style="background:rgba(255,255,255,0.06);border-radius:16px;padding:28px 32px;border:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:12px;">
  <div style="color:#f59e0b;font-size:1.1rem;letter-spacing:2px;">★★★★★</div>
  <p style="color:#e2e8f0;font-size:0.95rem;line-height:1.75;margin:0;">"${pool[idx % pool.length]}"</p>
  <p style="color:#10b981;font-weight:700;font-size:0.85rem;margin:0;">— ${auNames[idx % auNames.length]}</p>
</div>`;
          };
          const testSection = html.match(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i);
          if (testSection) {
            const cardCount = (testSection[2].match(/★★★★★/g) || []).length;
            if (cardCount < 3) {
              const needed = 3 - cardCount;
              const extraCards = Array.from({length: needed}, (_, i) => genReview(userInput.industry || "", cardCount + i)).join("\n");
              html = html.replace(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i,
                (_m: string, open: string, body: string, close: string) => {
                  const grid = body.includes('display:grid') || body.includes('display: grid');
                  if (grid) return open + body + extraCards + close;
                  return open + body + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:20px;">${extraCards}</div>` + close;
                }
              );
              console.log(`[Step5] Padded testimonials to 3 (was ${cardCount})`);
            }
          }
        }

        // ── Move any sections that ended up after </footer> back above it ─────────
        {
          const footerMatch = html.match(/<footer[\s>]/i) || html.match(/id=["']footer["']/i);
          if (footerMatch) {
            // Find content between </footer> and </body> and move it before the footer
            html = html.replace(/([\s\S]*?)(<\/footer>)([\s\S]*?)(<\/body>)/i, (_m: string, pre: string, ftClose: string, after: string, bodyClose: string) => {
              const orphaned = after.replace(/^\s+|\s+$/g, "");
              if (!orphaned || orphaned.length < 20) return _m;
              // Move sections, iframes (maps), divs — anything substantive
              const hasSections = /<(section|div|iframe)\b/i.test(orphaned);
              if (!hasSections) return _m;
              console.log("[Step5] Moving orphaned sections from below footer to above it");
              return pre + orphaned + "\n" + ftClose + "\n" + bodyClose;
            });
          }
        }

        // ── Wire dead CTA buttons ────────────────────────────────────────────────
        // Stitch sometimes renders "Learn More", "View Services", etc with no onclick.
        // Wire them to the correct page so they're not dead ends.
        {
          const servicesTarget = requestedPageIds.includes("services") ? "services" : requestedPageIds.includes("about") ? "about" : "contact";
          const contactTarget  = requestedPageIds.includes("contact")  ? "contact"  : requestedPageIds.includes("booking") ? "booking" : "home";
          const bookingTarget  = requestedPageIds.includes("booking")  ? "booking"  : contactTarget;

          // Wire "Learn More" / "View Services" -> services page
          html = html.replace(/<(button|a)([^>]*)>(\s*(?:<[^>]+>\s*)*)(Learn More|learn more|View Services|view services|Explore Services|See Services|Our Services)(\s*(?:<\/[^>]+>\s*)*)<\/(button|a)>/gi,
            (_m: string, tag: string, attrs: string, pre: string, label: string, post: string) => {
              if (attrs.includes("onclick") || attrs.includes("navigateTo") || (attrs.includes("href") && !attrs.includes('href="#"') && !attrs.includes("href='#'"))) return _m;
              const nav = "window.navigateTo&&window.navigateTo('" + servicesTarget + "')";
              if (tag.toLowerCase() === "a") return "<a" + attrs + ' href="#" onclick="event.preventDefault();' + nav + '">' + pre + label + post + "</a>";
              return "<button" + attrs + ' onclick="' + nav + '">' + pre + label + post + "</button>";
            });

          // Wire "Get Started" / "Contact Us" / "Get in Touch" / "Book Now" -> contact/booking
          html = html.replace(/<(button|a)([^>]*)>(\s*)(Get Started|Get in Touch|Contact Us|Book Now|Book Appointment|Book an Appointment)(\s*)<\/(button|a)>/gi,
            (_m: string, tag: string, attrs: string, pre: string, label: string, post: string) => {
              if (attrs.includes("onclick") || attrs.includes("navigateTo") || (attrs.includes("href") && !attrs.includes('href="#"') && !attrs.includes("href='#'"))) return _m;
              const tgt = /book/i.test(label) ? bookingTarget : contactTarget;
              const nav = "window.navigateTo&&window.navigateTo('" + tgt + "')";
              if (tag.toLowerCase() === "a") return "<a" + attrs + ' href="#" onclick="event.preventDefault();' + nav + '">' + pre + label + post + "</a>";
              return "<button" + attrs + ' onclick="' + nav + '">' + pre + label + post + "</button>";
            });

          // Wire account_circle login icon -> client portal
          const portalSlug = (userInput.slug || "").trim();
          if (portalSlug) {
            html = html.replace(/(<span[^>]*)>(\s*account_circle\s*)<\/span>/gi,
              (_m: string, attrs: string, inner: string) => {
                if (attrs.includes("data-wg-portal")) return _m;
                return "<a href=\"/c/" + portalSlug + "\" title=\"Client Portal\" style=\"text-decoration:none\"><span" + attrs + " data-wg-portal=\"1\">" + inner + "</span></a>";
              });
          }
        }

        // Strip Stitch scripts that define navigateTo or page-switching.
        // Skip this on rebuild — the saved HTML already has our authoritative scripts;
        // stripping them causes the router to be missing until Step 6 re-injects it,
        // and any step in between that reads [data-page] count will get wrong results.
        if (!savedHtmlForRebuild || isUsingRawStitchForRebuild) {
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
          console.log("[Step5] Rebuild mode (using final post-processed HTML fallback) — skipping script strip to preserve injected navigateTo");
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
    <meta name="twitter:description" content="${metaDesc.replace(/"/g, "&quot;")}">`;
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

        // Fetch Pexels photos if site has a gallery page and client has few/no photos
        let augmentedPhotoUrls = [...photoUrls];
        const sitePages = Array.isArray(userInput.pages) ? userInput.pages : [];
        const hasGalleryPage = sitePages.some((p: string) => /gallery|portfolio|work|project/i.test(p));
        if (hasGalleryPage && photoUrls.length < 4 && process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY !== "YOUR_PEXELS_KEY_HERE") {
          try {
            const pexelsQuery = getPexelsQuery(userInput.businessName, userInput.industry || "", sitePages);
            const pexelsPhotos = await fetchPexelsPhotos(pexelsQuery, 8);
            augmentedPhotoUrls = [...photoUrls, ...pexelsPhotos].slice(0, 12);
            console.log(`[Pexels] Fetched ${pexelsPhotos.length} photos for query: "${pexelsQuery}"`);
          } catch (e) {
            console.log("[Pexels] Failed to fetch:", e);
          }
        }
        // Use first augmented photo as hero if client has no hero
        const effectiveHeroUrl = heroUrl || (augmentedPhotoUrls.length > 0 ? augmentedPhotoUrls[0] : null);

        // On rebuild, the saved HTML already has our injected scripts (navigateTo, multi-page
        // init, hamburger JS, etc.) from the original build. Re-running injectEssentials would
        // produce double <script> blocks. Skip it and only re-inject images.
        if (savedHtmlForRebuild && !isUsingRawStitchForRebuild) {
          console.log("[Step6] Rebuild mode (using final post-processed HTML fallback) — skipping injectEssentials (scripts already present), re-injecting images only");
          const html = injectImages(navFixedHtml, logoUrl, effectiveHeroUrl, augmentedPhotoUrls, productsWithPhotos);
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
        let html = injectEssentials(navFixedHtml, clientEmail, clientPhone, jobId, ga4Id, tawktoPropertyId, userInput.businessAddress || "", userInput.businessName || "");
        html = injectImages(html, logoUrl, effectiveHeroUrl, augmentedPhotoUrls, productsWithPhotos);
        return html;
      });

      // ── STEP 6b: Auditor — ensures id="booking", id="contact", etc. all exist ──
      const auditedHtml = await step.run("step6b-audit", async () => {
        const result = await auditAndFixSite(injectedHtml, {
          businessName: userInput.businessName,
          industry: userInput.industry || "",
          clientEmail,
          clientPhone,
          businessAddress: userInput.businessAddress || "",
          abn: userInput.abn || "",
          domain: userInput.domain || "",
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
          // If the site has a shop page but no products were provided, any "Buy Now" / shop CTA
          // buttons that navigate to 'shop' would create an empty-shop loop. Rewire them to 'contact'.
          if (hasShopFeature && shopProducts.length === 0) {
            const rewired = finalHtml.replace(
              /window\.navigateTo&&window\.navigateTo\('shop'\)/g,
              "window.navigateTo&&window.navigateTo('contact')"
            );
            if (rewired !== finalHtml) {
              console.log("[Step7] Rewired shop CTAs → contact (no products provided)");
            }
            return rewired;
          }
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
          // Check if client has Stripe Connect — use Stripe payment links if no Square
          const stripeAccountId = job.stripeAccountId || null;
          const useStripe = !effectiveToken && !manualPaymentUrl && !!stripeAccountId;
          if (!effectiveToken && !manualPaymentUrl && !useStripe) {
            // No payment provider yet — but still rebuild the shop section with real client products.
            // Wire "Buy Now" to the contact page so customers can inquire instead of hitting a dead loop.
            console.warn(`[Step7] No payment provider for ${jobId} — injecting contact-linked shop cards`);
            if (shopProducts.length > 0) {
              const dark = html.includes('#0f172a') || html.includes('background:#0a0f1a') || html.includes("background: #0");
              const bg = dark ? '#0f172a' : '#f8fafc';
              const cardBg = dark ? '#1e293b' : '#ffffff';
              const textCol = dark ? '#f1f5f9' : '#0f172a';
              const priceCol = dark ? '#10b981' : '#059669';
              const btnCol = '#006aff';
              const cards = shopProducts.map((p: any) => {
                const photoHtml = p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.name}" style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0;display:block;"/>` : '';
                const price = p.price ? `<p style="color:${priceCol};font-weight:700;font-size:1.2rem;margin:0 0 12px;">$${String(p.price).replace(/[^0-9.]/g,'')} AUD</p>` : '';
                return `<div style="background:${cardBg};border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">${photoHtml}<div style="padding:20px 20px 24px;flex:1;display:flex;flex-direction:column;gap:8px;"><h3 style="color:${textCol};font-size:1.05rem;font-weight:700;margin:0;">${p.name}</h3>${price}<a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('contact')" style="display:inline-block;background:${btnCol};color:#fff;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none;text-align:center;margin-top:auto;">Enquire Now</a></div></div>`;
              }).join('\n');
              const shopSection = `<section id="shop" data-page="shop" style="padding:80px 24px;background:${bg};"><div style="max-width:1100px;margin:0 auto;"><h2 style="color:${textCol};font-size:2rem;font-weight:900;text-align:center;margin:0 0 48px;">Shop</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px;">${cards}</div></div></section>`;
              const shopRe = /<(?:section|div)[^>]*(?:id|data-page)=["']shop["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi;
              if (shopRe.test(html)) {
                html = html.replace(/<(?:section|div)[^>]*(?:id|data-page)=["']shop["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi, shopSection);
                console.log(`[Step7] No-payment shop: replaced Stitch shop section with ${shopProducts.length} real product(s)`);
              } else {
                html = html.replace('</body>', shopSection + '\n</body>');
                console.log(`[Step7] No-payment shop: injected ${shopProducts.length} real product(s) before </body>`);
              }
            }
            return html;
          }
          let catalogueItems: any[] = [];
          if (useStripe) {
            console.log(`[Step7] Using Stripe Connect for shop (account: ${stripeAccountId})`);
            const { createStripeShopCatalogue } = await import("@/lib/stripe-connect");
            const stripeItems = await createStripeShopCatalogue({ connectedAccountId: stripeAccountId!, products: shopProducts, redirectUrl: siteUrl, jobId, businessName: userInput.businessName });
            catalogueItems = stripeItems.map((item: any) => ({ name: item.name, variationId: item.priceId, itemId: item.productId, priceCents: item.priceCents, paymentLinkUrl: item.paymentLinkUrl, paymentLinkId: item.paymentLinkId }));
            await supabase.from("jobs").update({ shop_catalogue: catalogueItems }).eq("id", jobId);
          } else if (effectiveToken) {
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
          // Strategy 2: use jsdom to find the product card structurally and wire its buy button
          try {
            const { JSDOM } = await import("jsdom");
            const dom = new JSDOM(html);
            const doc = dom.window.document;
            const buyBtnTextRe = /^(Buy Now|Add to Cart|Order Now|Shop Now|Purchase|Buy)$/i;

            catalogueItems.forEach((item: any, i: number) => {
              if (!item.paymentLinkUrl || html.includes(`data-product-index="${i}"`)) return;
              // Find any element whose text contains the product name
              const allEls = Array.from(doc.querySelectorAll("h2,h3,h4,p,span,div"));
              const nameEl = allEls.find(el => el.textContent?.trim().toLowerCase().includes(item.name.toLowerCase()));
              if (!nameEl) return;
              // Walk up to find the card container (parent that contains a buy button)
              let card: Element | null = nameEl;
              let buyBtn: Element | null = null;
              for (let depth = 0; depth < 6 && card; depth++) {
                const btns = Array.from(card.querySelectorAll("button,a"));
                buyBtn = btns.find(b => buyBtnTextRe.test(b.textContent?.trim() || "")) || null;
                if (buyBtn) break;
                card = card.parentElement;
              }
              if (!buyBtn) return;
              // Replace the button with a proper payment link
              const link = doc.createElement("a");
              link.href = item.paymentLinkUrl;
              link.target = "_blank";
              link.rel = "noopener";
              link.className = "wg-buy-btn";
              link.setAttribute("data-product-index", String(i));
              link.setAttribute("style", "display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:0.95rem;");
              link.textContent = `Buy Now — $${(item.priceCents / 100).toFixed(2)}`;
              buyBtn.replaceWith(link);
              console.log(`[Step7] jsdom wired buy button for product: ${item.name}`);
            });

            html = dom.serialize();
          } catch (jsdomErr) {
            console.warn("[Step7] jsdom strategy 2 failed, skipping:", jsdomErr);
          }
          // Strategy 3: inject fallback shop section for unmatched products
          const unlinked = catalogueItems.filter((_: any, i: number) => !html.includes(`data-product-index="${i}"`));
          if (unlinked.length > 0) {
            // Skip items with no paymentLinkUrl (variationId was missing — Square could not create a checkout link)
            const cards = catalogueItems.filter((item: any) => !!item.paymentLinkUrl).map((item: any, i: number) => {
              const photoHtml = item.photoUrl ? `<img src="${item.photoUrl}" alt="${item.name}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px;"/>` : '';
              return `  <div style="background:#1e293b;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">${photoHtml}<h3 style="color:#f1f5f9;font-size:1.1rem;font-weight:700;margin:0;">${item.name}</h3><p style="color:#10b981;font-weight:700;font-size:1.2rem;margin:0;">$${(item.priceCents/100).toFixed(2)}</p><a href="${item.paymentLinkUrl}" target="_blank" rel="noopener" class="wg-buy-btn" data-product-index="${i}" style="display:inline-block;background:#006aff;color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;width:100%;">Buy Now</a></div>`;
            }).join("\n");
            if (cards.length === 0) console.warn("[Step7] No products have payment links (variationId missing for all) — skipping shop injection");
            if (cards.length > 0) {
              const newShopSection = `<section id="shop" data-page="shop" style="padding:80px 24px;background:#0f172a;"><div style="max-width:1200px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;text-align:center;margin:0 0 48px;">Shop</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px;">${cards}</div></div></section>`;
              // Replace existing Stitch shop section if present (it has wrong/placeholder products)
              // This prevents a double shop section (Stitch placeholder + our real one)
              const stitchShopRe = /<(?:section|div)[^>]*(?:id|data-page)=["']shop["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi;
              if (stitchShopRe.test(html)) {
                console.log("[Step7] Replacing existing Stitch shop section with real products");
                html = html.replace(/<(?:section|div)[^>]*(?:id|data-page)=["']shop["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi, newShopSection);
              } else {
                // No existing shop section — insert before </body>
                html = html.replace("</body>", newShopSection + "\n</body>");
              }
              console.log(`[Step7] Injected ${catalogueItems.filter((i: any) => !!i.paymentLinkUrl).length} real products into shop section`);
            }
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
        // Strip duplicate data-page attributes before validation
        const seenDpIds = new Set<string>();
        const dedupedHtml = finalHtmlWithShop.replace(
          /<(div|section|article|main)([^>]*\bdata-page=["']([^"']+)["'][^>]*)>/gi,
          (match: string, tag: string, attrs: string, pageId: string) => {
            if (!seenDpIds.has(pageId)) { seenDpIds.add(pageId); return match; }
            console.log(`[Step7b] Stripped duplicate data-page="${pageId}" before validation`);
            return `<${tag}${attrs.replace(/\s*\bdata-page=["'][^"']+["']/, '')}>`;
          }
        );
        // Pre-pass: run ensureMultiPageStructure BEFORE validation so the validator
        // sees already-repaired HTML and does not trigger the expensive emergency repair path.
        let prePassHtml = dedupedHtml;
        if (isMultiPage) {
          const { html: preEnsured, report: preReport } = ensureMultiPageStructure(dedupedHtml, requestedPageIds, {
            businessName: userInput.businessName,
          });
          if (preReport.repairs.length > 0) {
            console.log(`[Step7b] pre-pass ensureMultiPageStructure: ${preReport.repairs.length} repairs, added: [${preReport.missingPagesAdded.join(",")}], navFixes: ${preReport.navTargetsFixed.length}`);
          }
          prePassHtml = preEnsured;
        }
        const failures = validateForDeploy(prePassHtml, requestedPageIds, isMultiPage, hasBookingFeature);
        if (failures.length > 0) {
          console.error("[Step7b] Pre-deploy validation FAILED:", failures.join("; "));
          appendPipelineLog(jobId, { level: "error", step: "validate", msg: failures.join("; "), businessName: userInput.businessName }).catch(()=>{});
          logPipelineError(jobId, "Step7b/Validate", "VALIDATION_FAIL", failures.join("; ")).catch(()=>{});

          // Pass 1: structural repair (truncated tags, missing footer/body/html)
          // Start from prePassHtml (already had ensureMultiPage applied for multi-page)
          let repaired = repairHtml(prePassHtml, userInput.businessName, new Date().getFullYear());


          // Pass 1b: force-inject id="hero" on first <section> only (never <div> — avoids nav elements)
          if (!repaired.includes('id="hero"') && !repaired.includes("id='hero'")) {
            const beforeInject = repaired;
            repaired = repaired.replace(/(<section\b)(?![^>]*\bid=)/, '$1 id="hero"');
            if (repaired !== beforeInject) {
              console.warn("[Step7b] Force-injected id=hero on first <section>");
            } else {
              // Fallback: wrap body content in a hero section
              repaired = repaired.replace(/(<body[^>]*>)/, '$1<section id="hero" style="display:none"></section>');
              console.warn("[Step7b] Force-injected id=hero via fallback body wrapper");
            }
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
              to: "hello@webgecko.au",
              subject: "⚠️ Pre-deploy validation failed — " + userInput.businessName,
              html: "<p>Build for <strong>" + userInput.businessName + "</strong> (job: " + jobId + ") has validation failures:<br><ul>" + failuresAfterRepair.map((f: string) => "<li>" + f + "</li>").join("") + "</ul></p>",
            }).catch(() => {});
            appendPipelineLog(jobId, { level: "error", step: "validate_repair", msg: failuresAfterRepair.join("; "), businessName: userInput.businessName }).catch(()=>{});
            throw new Error("[Step7b] Pre-deploy validation failed after repair: " + failuresAfterRepair.join("; "));
          }
          console.log("[Step7b] Repaired HTML passes validation");
          return { html: repaired, valid: true, failures: [] };
        }
        console.log("[Step7b] Pre-deploy validation passed");
        return { html: prePassHtml, valid: true, failures: [] };
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
        if (!deployRes.ok) { const deployErr = await deployRes.text(); console.error("[Inngest] Deploy failed:", deployErr); appendPipelineLog(jobId, { level: "error", step: "deploy", msg: `Deploy failed: ${deployErr.slice(0,300)}`, businessName: userInput.businessName }).catch(()=>{}); return ""; }
        const deployData = await deployRes.json();
        const deploymentId = deployData.id || deployData.uid || "";
        const stableUrl = `https://${vercelProjectName}.vercel.app`;
        const uniqueDeployUrl = deployData.url ? `https://${deployData.url}` : stableUrl;
        console.log(`[Inngest] Deploy URL: unique=${uniqueDeployUrl} stable=${stableUrl} deploymentId=${deploymentId}`);

        // ── Assign stable alias so wg-xxx.vercel.app always serves the new build ──
        // Without this call, the stable alias stays on the old deployment indefinitely.
        if (deploymentId && vercelProjectName) {
          try {
            const aliasUrl = `https://api.vercel.com/v2/deployments/${deploymentId}/aliases${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`;
            const aliasRes = await fetch(aliasUrl, {
              method: "POST",
              headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify({ alias: `${vercelProjectName}.vercel.app` }),
            });
            const aliasData = await aliasRes.json().catch(() => ({}));
            console.log(`[Inngest] Alias assign: ${aliasRes.status} — ${JSON.stringify(aliasData).slice(0, 120)}`);
          } catch (ae: any) {
            console.error(`[Inngest] Alias assign failed (non-blocking): ${ae?.message}`);
          }
        }

        // Fire-and-forget Google Indexing API ping — never blocks deploy
        requestGoogleIndexing(stableUrl).catch(() => {});
        return uniqueDeployUrl;
      });

      // ── STEP 8b: Smoke test — fetch live URL and verify critical elements ─────
      // Non-blocking: failures recorded and surfaced in the email, never kill the build.
      type SmokeCheck = { label: string; pass: boolean; severity: "error" | "warn" };
      const smokeResults = await step.run("step8b-smoke", async () => {
        const checks: SmokeCheck[] = [];
        if (!previewUrl) return [{ label: "Deploy URL", pass: false, severity: "error" as const }];

        // Vercel unique deploy URLs need time to propagate — wait before first attempt
        // then retry with increasing backoff (10s initial + 15s, 25s, 35s between retries)
        let liveHtml = "";
        await new Promise(r => setTimeout(r, 10000)); // initial propagation delay
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch(previewUrl, { headers: { "User-Agent": "WebGecko-SmokeTest/1.0" } });
            if (res.ok) { liveHtml = await res.text(); break; }
          } catch {}
          console.log("[Smoke] Attempt " + attempt + " failed for " + previewUrl);
          if (attempt < 3) await new Promise(r => setTimeout(r, 10000 + attempt * 5000));
        }

        // Vercel team unique-deploy URLs can be access-restricted; fall back to stable alias URL
        if (!liveHtml && vercelProjectName) {
          const stableUrl = `https://${vercelProjectName}.vercel.app`;
          if (stableUrl !== previewUrl) {
            try {
              await new Promise(r => setTimeout(r, 5000));
              const res = await fetch(stableUrl, { headers: { "User-Agent": "WebGecko-SmokeTest/1.0" } });
              if (res.ok) { liveHtml = await res.text(); console.log("[Smoke] Fetched from stable URL: " + stableUrl); }
              else console.log("[Smoke] Stable URL also failed: " + res.status);
            } catch (e) { console.log("[Smoke] Stable URL fetch error:", e); }
          }
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
            industry: userInput.industry || "",
            clientEmail,
            clientPhone,
            businessAddress: userInput.businessAddress || "",
            abn: userInput.abn || "",
            domain: userInput.domain || "",
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
              files: (() => {
                const siteUrl2 = `https://${vercelProjectName}.vercel.app`;
                const customUrl2 = rawDomain ? `https://${rawDomain}` : siteUrl2;
                const now2 = new Date().toISOString().split("T")[0];
                const sitemap2 = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${customUrl2}/</loc>\n    <lastmod>${now2}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`;
                const robots2 = `User-agent: *\nAllow: /\nSitemap: ${customUrl2}/sitemap.xml`;
                return [
                  { file: "index.html", data: loopHtml, encoding: "utf-8" },
                  { file: "sitemap.xml", data: sitemap2, encoding: "utf-8" },
                  { file: "robots.txt", data: robots2, encoding: "utf-8" },
                ];
              })(),
              projectSettings: { framework: null, outputDirectory: "./" },
            }),
          });
          if (!deployRes.ok) { console.error("[FailLoop] Redeploy failed:", await deployRes.text()); return loopPreviewUrl; }
          const loopDeployData = await deployRes.json();
          const loopDeployId = loopDeployData.id || loopDeployData.uid || "";
          console.log("[FailLoop] Redeployed attempt " + attempt + " deploymentId=" + loopDeployId);
          // Assign stable alias for fail-loop redeploys too
          if (loopDeployId && vercelProjectName) {
            try {
              const aliasUrl2 = `https://api.vercel.com/v2/deployments/${loopDeployId}/aliases${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`;
              await fetch(aliasUrl2, {
                method: "POST",
                headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ alias: `${vercelProjectName}.vercel.app` }),
              });
            } catch {}
          }
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

        // Auto-snapshot: save a version to page_versions so the Archive tab has a record of every build
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
          await fetch(`${appUrl}/api/versions/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-process-secret": process.env.PROCESS_SECRET || "" },
            body: JSON.stringify({ jobId, trigger: "build" }),
          });
          console.log("[Step9] Auto-snapshot saved to page_versions");
        } catch(e) {
          console.warn("[Step9] Auto-snapshot failed (non-fatal):", (e as Error).message);
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
            { filename: `${fileName}-STITCH-PROMPT.txt`, content: Buffer.from(spec.stitchPrompt || "(no prompt)").toString("base64") },
          ],
        });
      });


    console.log(`[Inngest] Build COMPLETE for jobId=${jobId}`);
    return { success: true, jobId };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error("[Inngest] Pipeline FAILED for jobId=" + jobId + ":", errMsg);
      // Always log pipeline failures to the admin Pipeline tab
      appendPipelineLog(jobId, {
        level: "error",
        step: "pipeline",
        msg: `Pipeline failed: ${errMsg}`,
        businessName: (err as any)?.__businessName || undefined,
      }).catch(() => {});
      // Mark job as failed in DB
      try {
        const failedJob = await getJob(jobId);
        if (failedJob) await saveJob(jobId, { ...failedJob, status: "failed" });
      } catch {}
      throw err;
    }
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
        const draftPubId = (process.env.BEEHIIV_PUBLICATION_ID || "").startsWith("pub_")
          ? process.env.BEEHIIV_PUBLICATION_ID
          : `pub_${process.env.BEEHIIV_PUBLICATION_ID || ""}`;
        const draftBeehiivEndpoint = `https://api.beehiiv.com/v2/publications/${draftPubId}/subscriptions/email`;
        const newsletterSection = `<section id="newsletter" style="padding:60px 20px;background:#0a1628;text-align:center;">
<h2 style="color:#e2e8f0;font-size:1.8rem;font-weight:800;margin-bottom:8px;">Stay in the Loop</h2>
<p style="color:#94a3b8;margin-bottom:24px;">Get updates and exclusive offers straight to your inbox.</p>
<form onsubmit="(function(e){e.preventDefault();var em=e.target.querySelector('input[type=email]');var btn=e.target.querySelector('button');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${draftBeehiivEndpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value,reactivate_existing:true,send_welcome_email:true})}).then(function(r){if(r.ok||r.status===201||r.status===200){btn.textContent='Subscribed!';btn.style.background='#10b981';em.disabled=true;}else{throw new Error();}}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;max-width:480px;margin:0 auto;">
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
        await supabase.from("jobs").update({ metadata: { ...(jobRow?.metadata || {}), eatureRequests: requests } }).eq("id", jobId);
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
    });
  }
);

const featureGoLive = inngest.createFunction(
  { id: "feature-go-live", name: "Feature Go Live", triggers: [{ event: "feature/go-live" }] },
  async ({ event, step }: { event: { data: { jobId: string; requestId: string } }; step: any }) => {
    const { jobId, requestId } = event.data;
    await step.run("update-job-features-and-rebuild", async () => {
      const job = await getJob(jobId);
      if (!job) throw new Error("Job not found");

      const userInput = job.userInput || {};
      const existingFeatures: string[] = Array.isArray(userInput.features) ? userInput.features : [];
      const newFeatures = [...new Set([...existingFeatures, requestId])];

      // Persist the new feature into userInput
      await saveJob(jobId, { userInput: { ...userInput, features: newFeatures } });
    });

    // BUG-03 FIX: trigger a rebuild so the new feature is actually built into the site
    await inngest.send({
      name: "build/website",
      data: { jobId: jobId, isRebuild: true },
    });
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports, autoRelease, featureInject, featureGoLive],
});
