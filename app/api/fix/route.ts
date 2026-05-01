import { NextRequest } from "next/server";
import { Resend } from "resend";
import {
  checkAndFixLinks,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { generateBookingWidget } from "@/lib/booking-widget";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability } from "@/lib/db";

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
      projectSettings: { framework: null, outputDirectory: "./" },
    }),
  });
  if (!resp.ok) throw new Error(`Vercel deploy failed: ${await resp.text()}`);
  return `https://${safeName}.vercel.app`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("id") || url.searchParams.get("jobId");
  const secret = url.searchParams.get("secret");

  if (!jobId || !secret) return new Response("Missing jobId or secret", { status: 400 });
  if (secret !== process.env.PROCESS_SECRET) return new Response("Forbidden", { status: 403 });

  const job = await getJob(jobId);
  if (!job) return new Response("Job not found", { status: 404 });

  const { userInput, logoUrl, heroUrl, photoUrls = [], productsWithPhotos = [], hasBooking, clientSlug } = job;
  const clientEmail = userInput?.email || "";
  const clientPhone = userInput?.phone || "";
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const hasBookingFeature = hasBooking || features.includes("Booking System");

  console.log(`[Fix] Code-only fix pass for job: ${jobId} — ${userInput?.businessName}`);

  try {
    let html: string = job.html || "";
    if (!html || html.length < 5000) return new Response(`No valid HTML (${html.length} chars)`, { status: 400 });

    // Contact details
    const clientDomain = clientEmail.split("@")[1] || "";
    const businessSlug = (userInput?.businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    html = html.replace(/\b[\w.+-]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample|placeholder|site|gym|studio|salon|clinic|law|dental|realty|auto|cafe|restaurant)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
    if (clientDomain && businessSlug) {
      html = html.replace(/\b(info|hello|contact|admin|support|enquiries|enquiry|mail|office|reception|noreply|no-reply)@([\w-]+)\.(com|com\.au|au|net|org)\b/gi, (m: string, _prefix: string, domain: string) => {
        if (m === clientEmail || m.includes("webgecko")) return m;
        if (m.toLowerCase().endsWith(clientDomain.toLowerCase())) return m;
        const ds = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (ds.includes(businessSlug.slice(0, 6)) || businessSlug.includes(ds.slice(0, 6))) return clientEmail;
        return m;
      });
    }
    html = html.replace(/\b0[0-9]{3}\s000\s000\b/g, clientPhone);
    html = html.replace(/\b0400\s000\s000\b/g, clientPhone);

    // CTA buttons
    const bookingNavTarget = hasBookingFeature ? "booking" : "contact";
    const ctaKeywords = ['Book Now','Book a Session','Get Started','Join Now','Sign Up','Free Trial','Book Free','Reserve','Enquire Now','Get a Quote','Start Today','Book Today','Schedule Now'];
    html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
      if (isBooking && !attrs.includes('navigateTo') && !attrs.includes('onclick')) {
        return `<a${attrs} onclick="event.preventDefault();var el=document.getElementById('${bookingNavTarget}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${bookingNavTarget}');}">${inner}</a>`;
      }
      return match;
    });

    // Google Maps
    const businessAddress = userInput?.businessAddress || "";
    if (businessAddress && process.env.GOOGLE_MAPS_API_KEY && !html.includes('google.com/maps')) {
      const mapsEmbed = `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`;
      html = html.replace(/(<section[^>]*(?:id|class)="[^"]*contact[^"]*"[^>]*>)([\s\S]*?)(<\/section>)/gi, (_m: string, open: string, body: string, close: string) => {
        const lastDiv = body.lastIndexOf('</div>');
        if (lastDiv !== -1) return open + body.slice(0, lastDiv) + mapsEmbed + body.slice(lastDiv) + close;
        return open + body + mapsEmbed + close;
      });
    }

    // Strip Calendly
    html = html.replace(/<script[^>]*calendly[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<link[^>]*calendly[^>]*/gi, '');

    // Copyright year
    const currentYear = new Date().getFullYear().toString();
    html = html.replace(/(©\s*|&copy;\s*|copyright\s+)20\d\d\b/gi, (_m: string, prefix: string) => prefix + currentYear);

    // Essentials + images
    const { html: checkedHtml } = checkAndFixLinks(html, Array.isArray(userInput?.pages) ? userInput.pages : []);
    const ga4Id = job.ga4Id || userInput?.ga4Id || "";
    html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id);
    html = injectImages(html, logoUrl, heroUrl, photoUrls, productsWithPhotos);

    // Booking widget
    const hasAiBookingPlaceholder = /(?:forge integration|booking system.*?recalibrat|advanced booking.*?recalibrat|calendly|acuity|setmore)/i.test(html);
    if (hasBookingFeature || hasAiBookingPlaceholder) {
      try {
        const services = getServicesForIndustry(userInput?.industry || "");
        let accentColor = "#D4AF37";
        const cssVarMatch = html.match(/--(?:primary|accent|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/);
        if (cssVarMatch?.[1]) accentColor = cssVarMatch[1];
        const bookingWidgetHtml = generateBookingWidget({
          jobId, businessName: userInput?.businessName || "",
          timezone: "Australia/Brisbane", services,
          primaryColor: accentColor,
          apiBase: "https://webgecko-builder.vercel.app",
        });
        html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*)\bid="booking"[^>]*>[\s\S]*?<\/\1>/gi, '<div id="booking"></div>');
        if (html.includes('id="booking"')) {
          html = html.replace('<div id="booking"></div>', bookingWidgetHtml);
        } else {
          html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
        }
      } catch (e) { console.error("[Fix] Booking widget failed:", e); }
    }

    // Deploy
    const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);
    const stableUrl = await deployToVercel(html, vercelProjectName);

    // Save to Supabase
    await saveJob(jobId, { ...job, html, previewUrl: stableUrl, fixedAt: new Date().toISOString() });
    if (clientSlug) {
      const existingClient = await getClient(clientSlug);
      if (existingClient) await saveClient(clientSlug, { ...existingClient, preview_url: stableUrl });
    }

    // Auto-create availability
    if (hasBookingFeature || hasAiBookingPlaceholder) {
      const existingAvail = await getAvailability(jobId);
      if (!existingAvail) {
        const slotMap: Record<string, number> = { medical:30,dental:30,physio:45,beauty:45,hair:45,massage:60,legal:60,accounting:60,financial:60,fitness:60,gym:60,personal:60 };
        const ind = (userInput?.industry || "").toLowerCase();
        const slotMins = Object.entries(slotMap).find(([k]) => ind.includes(k))?.[1] ?? 60;
        await saveAvailability(jobId, {
          businessName: userInput?.businessName || "", clientEmail,
          timezone: "Australia/Brisbane", days: [1,2,3,4,5],
          startHour: 9, endHour: 17, slotDurationMinutes: slotMins,
          bufferMinutes: 15, maxDaysAhead: 30,
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
        attachments: [
          { filename: `${(userInput?.businessName || jobId).replace(/[^a-zA-Z0-9]/g, "-")}-FIXED.html`, content: Buffer.from(html).toString("base64") },
        ],
      });
    } catch (e) { console.error("[Fix] Email failed:", e); }

    return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fix Complete</title>
<style>body{margin:0;background:#0a0f1a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#0f1623;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;max-width:480px;text-align:center;}
h1{color:#10b981;margin:0 0 8px;}p{color:#94a3b8;margin:0 0 20px;}
a{display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:16px;">✅</div>
<h1>Fix Complete</h1><p>${userInput?.businessName} — deployed to stable URL.</p>
<a href="${stableUrl}" target="_blank">View Fixed Site →</a></div></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

  } catch (err) {
    console.error("[Fix] Error:", err);
    return new Response(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 });
  }
}
