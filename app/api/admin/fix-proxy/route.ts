// app/api/admin/fix-proxy/route.ts
// Inline fix pass — does NOT call itself via HTTP (avoids timeout/base URL issues)
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  checkAndFixLinks,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
  ensureMultiPageStructure,
} from "@/lib/pipeline-helpers";
import { generateBookingWidget } from "@/lib/booking-widget";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability, appendPipelineLog } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY!);

async function deployToVercel(html: string, projectName: string): Promise<string> {
  const safeName = projectName.slice(0, 52);
  const resp = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safeName,
      teamId: process.env.VERCEL_TEAM_ID || undefined,
      files: [{ file: "index.html", data: html, encoding: "utf-8" }],
      target: "production",
      projectSettings: { framework: null, outputDirectory: "./" },
    }),
  });
  if (!resp.ok) throw new Error(`Vercel deploy failed: ${await resp.text()}`);
  await resp.json(); // consume response body
  // Always return stable alias — unique hash URLs go stale. Stable alias updates within ~10s.
  return `https://${safeName}.vercel.app`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let job: Awaited<ReturnType<typeof getJob>> | null = null;
  try {
    job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { userInput, logoUrl, heroUrl, photoUrls = [], productsWithPhotos = [], hasBooking, clientSlug } = job;
    const clientEmail = userInput?.email || "";
    const clientPhone = userInput?.phone || "";
    const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
    const hasBookingFeature = hasBooking || features.includes("Booking System");
    const isMultiPage = userInput?.siteType === "multi";

    let html: string = job.html || "";
    if (!html || html.length < 5000) {
      return NextResponse.json({ error: `No valid HTML stored (${html.length} chars)` }, { status: 400 });
    }

    console.log(`[Fix-Proxy] Running fix for ${jobId} — ${userInput?.businessName}`);

    // Parse explicit CTA destination URL from notes (same logic as Inngest pipeline)
    const ctaExternalUrl = (() => {
      const sources = [userInput?.additionalNotes || "", userInput?.goal || ""];
      for (const text of sources) {
        const m = text.match(/(?:link\s+to|point\s+to|go\s+to|direct\s+to|should\s+link\s+to|buttons?\s+should\s+link\s+to|cta[^.\n]*?:?\s+)(https?:\/\/[^\s,;)\n]+)/i);
        if (m) return m[1].replace(/[.,;)]+$/, "");
      }
      return "";
    })();

    // PRE-PASS: strip <canvas> elements entirely — static HTML sites never use canvas legitimately
    // They are always Stitch-generated fake map/animation placeholders
    html = html.replace(/<canvas[^>]*>[\s\S]*?<\/canvas>/gi, "");
    // Strip Stitch visual map placeholder boxes — broad catch
    html = html.replace(/<div[^>]*class="[^"]*(?:map|location|directions)[^"]*"[^>]*>[\s\S]{0,1500}?<\/div>/gi, (m: string) => {
      if (m.includes('<iframe')) return m;
      const textOnly = m.replace(/<[^>]+>/g, '').trim();
      if (/Map View|map-placeholder|map_icon/i.test(m)) return '';
      if (textOnly.length < 80 && /map|location|directions/i.test(m)) return '';
      return m;
    });
    html = html.replace(/<[a-z][^>]*>\s*Map View\s*:[^<]{0,100}<\/[a-z]+>/gi, '');
    // Strip Stitch "Service Area" placeholder cards (map icon + text, no real map inside)
    // These appear as a div with a map emoji/icon and text like "Serving Brisbane..."
    // Only remove if there's a real Google Maps embed elsewhere in the document
    if (html.includes('maps.google') || html.includes('google.com/maps') || html.includes('maps/embed')) {
      html = html.replace(/<(?:div|section)[^>]*>(?:(?!<iframe)[^])*?(?:Service Area|service.area|Serving\s+\w|service area)[^]*?<\/(?:div|section)>/gi, (m: string) => {
        if (m.includes('<iframe')) return m; // keep if it has a real map
        if (m.includes('google.com/maps') || m.includes('maps.google')) return m;
        const text = m.replace(/<[^>]+>/g, '').trim();
        if (text.length < 300 && /service.?area|serving\s+(brisbane|sydney|melbourne|perth|adelaide|ipswich|gold coast)/i.test(text)) return '';
        return m;
      });
    }

    // DEDUP: remove duplicate Google Maps iframes — keep only the first occurrence
    {
      let firstMapFound = false;
      html = html.replace(/<iframe[^>]+(?:maps\.google|maps\/embed|google\.com\/maps)[^>]*>[\s\S]*?<\/iframe>/gi, (m: string) => {
        if (!firstMapFound) { firstMapFound = true; return m; }
        return ''; // drop duplicate maps
      });
    }

    // DEDUP: remove duplicate newsletter sections — keep only the first occurrence
    {
      let firstNewsletterFound = false;
      html = html.replace(/(<(?:section|div)[^>]*>)([\s\S]{50,3000}?)<\/(?:section|div)>/gi, (m: string) => {
        const text = m.replace(/<[^>]+>/g, '').toLowerCase();
        const isNewsletter = (text.includes('subscribe') || text.includes('newsletter') || text.includes('stay in the loop')) &&
                             (m.includes('type="email"') || m.includes("type='email'") || (m.includes('placeholder') && text.includes('email')));
        if (!isNewsletter) return m;
        if (!firstNewsletterFound) { firstNewsletterFound = true; return m; }
        return ''; // drop duplicate newsletter blocks
      });
    }

    // FIX 1: Contact details — only replace clearly fake emails
    const clientDomain = clientEmail.split("@")[1] || "";
    const businessSlug = (userInput?.businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    html = html.replace(/\b[\w.+-]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample|placeholder|site|gym|studio|salon|clinic|law|dental|realty|auto|cafe|restaurant|johnsgymsydney|acmeconstruction|smithplumbing|greenthumb|eliteperformance|performancegym|purestrength|ironcore|urbanfit)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
    if (clientDomain && businessSlug) {
      html = html.replace(/\b(info|hello|contact|admin|support|enquiries|enquiry|mail|office|reception|noreply|no-reply)@([\w-]+)\.(com|com\.au|au|net|org)\b/gi, (m: string, _prefix: string, domain: string) => {
        if (m === clientEmail) return m;
        if (m.includes("webgecko")) return m;
        if (m.toLowerCase().endsWith(clientDomain.toLowerCase())) return m;
        const ds = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (ds.includes(businessSlug.slice(0, 6)) || businessSlug.includes(ds.slice(0, 6))) return clientEmail;
        return m;
      });
    }
    html = html.replace(/\b0[0-9]{3}\s000\s000\b/g, clientPhone);
    html = html.replace(/\b0400\s000\s000\b/g, clientPhone);
    html = html.replace(/\+61\s0[0-9]{3}\s000\s000/g, clientPhone);

    // FIX 2: CTA buttons — <a href="#"> and standalone <button> elements
    const bookingNavTarget = hasBookingFeature ? "booking" : "contact";
    const ctaKeywords = ['Book Now','Book a Session','Book Appointment','Book an Appointment','Get Started','Join Now','Sign Up','Free Trial','Book Free','Reserve','Enquire Now','Get a Quote','Start Today','Book Today','Schedule Now','Try Free','Get Free Quote','Book Consultation','Book','Make a Booking'];
    const planKeywords = ['choose','select plan','buy now','purchase','subscribe','get plan','upgrade'];
    // Nav section keywords — wire these to scroll to the right section by name
    const navSectionMap: Record<string,string> = {
      'services': 'services', 'our services': 'services',
      'about': 'about', 'our clinic': 'about', 'clinic': 'about',
      'contact': 'contact', 'contact us': 'contact', 'get in touch': 'contact',
      'testimonials': 'testimonials', 'reviews': 'testimonials',
      'faq': 'faq', 'faqs': 'faq',
      'gallery': 'gallery', 'pricing': 'pricing', 'plans': 'pricing',
      'assessments': 'booking', 'resources': 'resources', 'team': 'team',
      'details': 'services', 'learn more': 'about', 'view services': 'services',
      'explore': 'about', 'find out more': 'about',
    };
    const navSnippet = (target: string) => `var el=document.getElementById('${target}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${target}');}`;
    // <a href="#"> CTAs — only wire ones that have NO onclick at all
    // IMPORTANT: if Stitch already set onclick="navigateTo(...)" leave it completely alone
    html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
      // Skip anything that already has an onclick — Stitch wired it correctly
      if (attrs.includes('onclick')) return match;
      const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
      if (isBooking) return `<a${attrs} onclick="event.preventDefault();${navSnippet(bookingNavTarget)}">${inner}</a>`;
      const isPlan = planKeywords.some(k => txt.includes(k));
      if (isPlan) return `<a${attrs} onclick="event.preventDefault();${navSnippet('contact')}">${inner}</a>`;
      // Nav section links
      for (const [keyword, sectionId] of Object.entries(navSectionMap)) {
        if (txt === keyword || txt.startsWith(keyword)) {
          return `<a${attrs} onclick="event.preventDefault();${navSnippet(sectionId)}">${inner}</a>`;
        }
      }
      // Generic fallback: any remaining href="#" with meaningful text scrolls to contact
      if (txt.length > 1 && txt !== '#') {
        return `<a${attrs} onclick="event.preventDefault();${navSnippet('contact')}">${inner}</a>`;
      }
      return match;
    });
    // <button> CTAs that have no onclick
    html = html.replace(/<button([^>]*)>([\s\S]*?)<\/button>/g, (match: string, attrs: string, inner: string) => {
      // Skip anything already wired — including Stitch's navigateTo buttons
      if (attrs.includes('onclick') || attrs.includes('type="submit"') || attrs.includes("type='submit'")) return match;
      const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
      if (isBooking) return `<button${attrs} onclick="${navSnippet(bookingNavTarget)}">${inner}</button>`;
      const isPlan = planKeywords.some(k => txt.includes(k)) || /^choose\b|^select\b/.test(txt);
      if (isPlan) return `<button${attrs} onclick="${navSnippet('contact')}">${inner}</button>`;
      // Nav section buttons
      for (const [keyword, sectionId] of Object.entries(navSectionMap)) {
        if (txt === keyword || txt.startsWith(keyword)) {
          return `<button${attrs} onclick="${navSnippet(sectionId)}">${inner}</button>`;
        }
      }
      return match;
    });

    // FIX 2b: ctaExternalUrl — if client specified a URL in notes, inject it into CTAs that don't already have a real href/onclick
    if (ctaExternalUrl) {
      const allCtaKeywords = [...ctaKeywords, ...planKeywords, 'get started', 'learn more', 'explore', 'view', 'discover'];
      html = html.replace(/<a([^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
        if (!allCtaKeywords.some(k => txt.includes(k.toLowerCase()))) return match;
        if (/href=["'](?:mailto:|tel:|#\w)/i.test(attrs)) return match; // preserve real anchors
        // Skip if already has a working onclick (navigateTo, etc.)
        if (attrs.includes('onclick')) return match;
        return `<a${attrs.replace(/\s*href=["'][^"']*["']/gi, '')} href="${ctaExternalUrl}" target="_blank" rel="noopener">${inner}</a>`;
      });
      html = html.replace(/<button([^>]*)>([\s\S]*?)<\/button>/g, (match: string, attrs: string, inner: string) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
        if (attrs.includes('type="submit"') || attrs.includes("type='submit'")) return match;
        // Skip if already wired
        if (attrs.includes('onclick')) return match;
        if (!allCtaKeywords.some(k => txt.includes(k.toLowerCase()))) return match;
        return `<button${attrs} onclick="window.open('${ctaExternalUrl}','_blank')">${inner}</button>`;
      });
    }

    // FIX 3: Google Maps
    const businessAddress = userInput?.businessAddress || "";
    if (businessAddress && process.env.GOOGLE_MAPS_API_KEY) {
      const mapsEmbed = `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`;
      // Remove Stitch-generated fake canvas/SVG maps so we don't end up with two maps
      html = html.replace(/<(div|section)([^>]*(?:id|class)="[^"]*(?:map|location|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/(div|section)>/gi, (m: string, tag: string, attrs: string, body: string, closeTag: string) => {
        if (body.includes('<canvas') || (body.includes('<svg') && (body.includes('stroke') || body.includes('path')))) {
          return `<${tag}${attrs}></${closeTag}>`;
        }
        return m;
      });
      if (!html.includes('maps.google') && !html.includes('maps.embed') && !html.includes('google.com/maps')) {
        let mapInjected = false;
        const beforeLen = html.length;
        html = html.replace(/<div[^>]*>\s*MAP PLACEHOLDER[^<]*<\/div>/gi, mapsEmbed);
        if (html.length !== beforeLen) mapInjected = true;
        // Target div OR section with map-related id/class
        if (!mapInjected) {
          html = html.replace(/<(div|section)([^>]*(?:id|class)="[^"]*(?:map|location|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/(div|section)>/gi, (match: string, tag: string, attrs: string, body: string, closeTag: string) => {
            if (match.includes('iframe')) return match;
            mapInjected = true;
            return `<${tag}${attrs}>${mapsEmbed}</${closeTag}>`;
          });
        }
        if (!mapInjected) {
          html = html.replace(/(<section[^>]*(?:id|class)="[^"]*contact[^"]*"[^>]*>)([\s\S]*?)(<\/section>)/gi, (_m: string, open: string, body: string, close: string) => {
            const lastDiv = body.lastIndexOf('</div>');
            if (lastDiv !== -1) return open + body.slice(0, lastDiv) + mapsEmbed + body.slice(lastDiv) + close;
            return open + body + mapsEmbed + close;
          });
        }
      }
    }

    // FIX 4: Strip Calendly
    html = html.replace(/<script[^>]*calendly[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<link[^>]*calendly[^>]*/gi, '');

    // FIX 5: Copyright year
    const currentYear = new Date().getFullYear().toString();
    html = html.replace(/(©\s*|&copy;\s*|copyright\s+)20\d\d\b/gi, (_m: string, prefix: string) => prefix + currentYear);

    // Re-inject essentials + images using domInject (Cheerio-based, handles CSS backgrounds + gallery)
    const { html: checkedHtml } = checkAndFixLinks(html, Array.isArray(userInput?.pages) ? userInput.pages : []);
    const ga4Id = job.ga4Id || userInput?.ga4Id || "";
    html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id);

    // Augment photos with Pexels fallback (same as Inngest pipeline)
    let augmentedPhotoUrls = [...new Set(photoUrls as string[])];
    const PHOTO_BUFFER = 10;
    if (augmentedPhotoUrls.length < PHOTO_BUFFER && process.env.PEXELS_API_KEY && process.env.PEXELS_API_KEY !== "YOUR_PEXELS_KEY_HERE") {
      try {
        const { fetchPexelsPhotos, getPexelsQuery } = await import("@/lib/pipeline-helpers");
        const sitePages = Array.isArray(userInput?.pages) ? userInput.pages : [];
        const pexelsQuery = getPexelsQuery(userInput?.businessName || "", userInput?.industry || "", sitePages);
        const needed = PHOTO_BUFFER - augmentedPhotoUrls.length;
        const pexelsPhotos = await fetchPexelsPhotos(pexelsQuery, Math.max(needed, 6));
        augmentedPhotoUrls = [...augmentedPhotoUrls, ...pexelsPhotos];
        console.log(`[Fix-Proxy/Pexels] Fetched ${pexelsPhotos.length} photos (had ${photoUrls.length})`);
      } catch (e) {
        console.log("[Fix-Proxy/Pexels] Failed:", e);
      }
    }

    const { domInject } = await import("@/lib/dom-inject");
    const rawDomain: string = (userInput?.domain || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const effectiveHeroUrl = heroUrl || (augmentedPhotoUrls.length > 0 ? augmentedPhotoUrls[0] : undefined);
    const requestedPageIds = Array.isArray(userInput?.pages) && userInput.pages.length > 0
      ? userInput.pages.map((p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
      : ["home"];
    html = domInject({
      html,
      businessName: userInput?.businessName || "",
      clientEmail,
      clientPhone,
      businessAddress: userInput?.businessAddress || "",
      logoUrl: logoUrl || undefined,
      heroUrl: effectiveHeroUrl || undefined,
      photoUrls: augmentedPhotoUrls,
      bookingUrl: job.supersaasUrl || undefined,
      hasBookingFeature,
      isMultiPage,
      jobId,
      ga4Id: ga4Id || undefined,
      requestedPageIds,
      accentColor: undefined,
      socialLinks: {
        facebookPage: userInput?.facebookPage || "",
        instagramUrl: userInput?.instagramUrl || "",
        linkedinUrl: userInput?.linkedinUrl || "",
        tiktokUrl: userInput?.tiktokUrl || "",
        youtubeUrl: userInput?.youtubeUrl || "",
      },
      abn: userInput?.abn || "",
      customHeadHtml: (job as any).customHeadHtml || job.metadata?.customHeadHtml || "",
      customBodyHtml: (job as any).customBodyHtml || job.metadata?.customBodyHtml || "",
      customFooterHtml: (job as any).customFooterHtml || job.metadata?.customFooterHtml || "",
      privacyPageHtml: (job as any).privacyPageHtml || job.metadata?.privacyPageHtml || "",
      termsPageHtml: (job as any).termsPageHtml || job.metadata?.termsPageHtml || "",
      cookiePageHtml: (job as any).cookiePageHtml || job.metadata?.cookiePageHtml || "",
    });

    // Re-inject booking widget — skip when SuperSaas is configured (dom-inject handles that path)
    const hasAiBookingPlaceholder = /(?:forge integration|booking system.*?recalibrat|advanced booking.*?recalibrat|calendly|acuity|setmore)/i.test(html);
    if ((hasBookingFeature || hasAiBookingPlaceholder) && !job.supersaasUrl) {
      try {
        const services = getServicesForIndustry(userInput?.industry || "");
        let accentColor = "#D4AF37";
        const ctaBgMatch = html.match(/(?:class="[^"]*(?:btn|button|cta)[^"]*"[^>]*|id="[^"]*(?:cta|btn)[^"]*"[^>]*)style="[^"]*background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
        if (ctaBgMatch?.[1]) accentColor = ctaBgMatch[1];
        else {
          const cssVarMatch = html.match(/--(?:primary|accent|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/);
          if (cssVarMatch?.[1]) accentColor = cssVarMatch[1];
        }
        const bookingWidgetHtml = generateBookingWidget({
          jobId, businessName: userInput?.businessName || "",
          timezone: "Australia/Brisbane", services,
          primaryColor: accentColor,
          apiBase: (process.env.NEXT_PUBLIC_APP_URL || "https://webgeckofl.vercel.app"),
        });
        html = html.replace(/<section([^>]*)>([\s\S]*?(?:forge integration|booking system.*?recalibrat|advanced booking.*?recalibrat)[\s\S]*?)<\/section>/gi,
          (_m: string, attrs: string) => {
            const newAttrs = /id=["'][^"']*["']/.test(attrs) ? attrs.replace(/id=["'][^"']*["']/, 'id="booking"') : ` id="booking"${attrs}`;
            return `<section${newAttrs}></section>`;
          }
        );
        html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*)\bid="booking"[^>]*>[\s\S]*?<\/\1>/gi, '<div id="booking"></div>');
        if (html.includes('id="booking"')) {
          html = html.replace('<div id="booking"></div>', bookingWidgetHtml);
        } else {
          html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
        }
      } catch (e) {
        console.error("[Fix-Proxy] Booking widget injection failed:", e);
      }
    }

    // Footer always at bottom — strip and unconditionally re-inject so multi-page CSS stays current.
    html = html.replace(/<style[^>]*["']wg-footer-fix["'][^>]*>[\s\S]*?<\/style>/gi, "");
    {
      const multiPageCss = isMultiPage ? `[data-page]{display:none!important;opacity:0;}[data-page].active{display:block!important;opacity:1;}` : ``;
      const footerFixStyle = `<style data-wg="wg-footer-fix">body{display:flex;flex-direction:column;min-height:100vh;}${multiPageCss}[data-page]{flex:1 0 auto;}footer,#wg-footer{margin-top:auto;flex-shrink:0;padding-bottom:0;}</style>`;
      html = html.includes("</head>")
        ? html.replace(/<\/head>/i, footerFixStyle + "\n</head>")
        : footerFixStyle + html;
      if (!html.match(/<body[^>]*display:flex/i)) {
        html = html.replace(/<body([^>]*)>/i, (m: string, attrs: string) => {
          if (attrs.includes("style=")) return m.replace(/style=["']/, (s: string) => s + "display:flex;flex-direction:column;min-height:100vh;");
          return `<body${attrs} style="display:flex;flex-direction:column;min-height:100vh;">`;
        });
      }
      if (!html.match(/<footer[^>]*margin-top/i)) {
        html = html.replace(/<footer([^>]*)>/i, (m: string, attrs: string) => {
          if (attrs.includes("style=")) return m.replace(/style=["']/, (s: string) => s + "margin-top:auto;");
          return `<footer${attrs} style="margin-top:auto;">`;
        });
      }
    }

    // ── Multi-page Page Structure Verification ─────────────────────────────────
    if (isMultiPage) {
      const requestedPageIds = Array.isArray(userInput?.pages) && userInput.pages.length > 0
        ? userInput.pages.map((p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
        : ["home"];
      const { html: ensuredHtml, report } = ensureMultiPageStructure(html, requestedPageIds, {
        businessName: userInput?.businessName,
      });
      if (report.repairs.length > 0) {
        console.log("[Fix-Proxy] ensureMultiPageStructure applied " + report.repairs.length + " repairs during fix pass.");
      }
      html = ensuredHtml;
    }

    // Deploy
    const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);
    const stableUrl = await deployToVercel(html, vercelProjectName);

    // Save to Supabase
    const now = new Date().toISOString();
    await saveJob(jobId, { ...job, html, previewUrl: stableUrl, fixedAt: now, builtAt: now });
    if (clientSlug) {
      const existingClient = await getClient(clientSlug);
      if (existingClient) await saveClient(clientSlug, { ...existingClient, preview_url: stableUrl });
    }

    // Auto-create availability config if missing
    if (hasBookingFeature || hasAiBookingPlaceholder) {
      const existingAvail = await getAvailability(jobId);
      if (!existingAvail) {
        const slotMap: Record<string, number> = { medical:30,dental:30,physio:45,beauty:45,hair:45,massage:60,legal:60,accounting:60,financial:60,fitness:60,gym:60,personal:60 };
        const ind = (userInput?.industry || "").toLowerCase();
        const slotMins = Object.entries(slotMap).find(([k]) => ind.includes(k))?.[1] ?? 60;
        await saveAvailability(jobId, {
          businessName: userInput?.businessName || "",
          clientEmail,
          timezone: "Australia/Brisbane",
          days: [1,2,3,4,5],
          startHour: 9,
          endHour: 17,
          slotDurationMinutes: slotMins,
          bufferMinutes: 15,
          maxDaysAhead: 30,
          services: getServicesForIndustry(userInput?.industry || ""),
        });
      }
    }

    // Email owner
    try {
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `🔧 Fix Complete — ${userInput?.businessName}`,
        html: `<p>Fix pass complete for <strong>${userInput?.businessName}</strong>. <a href="${stableUrl}">View site →</a></p>`,
      });
    } catch (e) { console.error("[Fix-Proxy] Email failed:", e); }

    await appendPipelineLog(jobId, { level: "info", step: "fix_proxy", msg: `Fix pass complete → ${stableUrl}`, businessName: userInput?.businessName });
    return NextResponse.json({ ok: true, previewUrl: stableUrl, businessName: userInput?.businessName });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Fix-Proxy] Error:", err);
    await appendPipelineLog(jobId, { level: "error", step: "fix_proxy", msg: errMsg, businessName: job?.userInput?.businessName }).catch(()=>{});
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
