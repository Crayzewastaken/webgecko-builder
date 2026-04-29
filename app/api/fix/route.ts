import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import {
  checkAndFixLinks,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { generateBookingWidget } from "@/lib/booking-widget";

export const maxDuration = 300;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

async function deployToVercel(html: string, projectName: string): Promise<string> {
  // Use the stable project name — same as the original build so the URL doesn't change
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

  const job = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId!);
  if (!job) return new Response("Job not found", { status: 404 });

  const { userInput, logoUrl, heroUrl, photoUrls = [], productsWithPhotos = [], hasBooking, clientSlug } = job;
  const clientEmail = job.email || "";
  const clientPhone = job.phone || "";
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const hasBookingFeature = hasBooking || features.includes("Booking System");

  console.log(`[Fix] Code-only fix pass for job: ${jobId} — ${userInput?.businessName}`);

  try {
    // Start from the stored HTML (which is the last deployed version)
    let html: string = job.html || "";
    if (!html || html.length < 5000) {
      return new Response(`No valid HTML stored for this job (only ${html.length} chars — site may not have built correctly yet)`, { status: 400 });
    }
    // Reject skeleton placeholder HTML
    if (/<h1>\s*HOME PAGE\s*<\/h1>/i.test(html)) {
      return new Response("Stored HTML is a skeleton placeholder — please trigger a full rebuild", { status: 400 });
    }

    // ── Code-only fix pass (mirrors Step 5 of the build pipeline) ────────────
    const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

    // FIX 1: Contact details
    html = html.replace(/\b[a-z]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample)\.com\b/gi, clientEmail);
    html = html.replace(/\binfo@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
    html = html.replace(/\bhello@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
    html = html.replace(/\bcontact@[a-z-]+\.(com|com\.au|au)\b/gi, (m: string) => m.includes(clientEmail.split("@")[1]) ? m : clientEmail);
    html = html.replace(/\b0[0-9]{3}\s000\s000\b/g, clientPhone);
    html = html.replace(/\b0400\s000\s000\b/g, clientPhone);
    html = html.replace(/\+61\s0[0-9]{3}\s000\s000/g, clientPhone);

    // FIX 2: CTA buttons
    const ctaKeywords = ['Book Now','Book a Session','Get Started','Join Now','Sign Up','Free Trial','Book Free','Reserve','Enquire Now','Get a Quote','Start Today','Book Today','Schedule Now','Try Free','Get Free Quote','Book Consultation'];
    html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/g, (match: string, attrs: string, inner: string) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      const isBooking = ctaKeywords.some(k => txt.includes(k.toLowerCase()));
      if (isBooking && !attrs.includes('navigateTo') && !attrs.includes('onclick')) {
        return `<a${attrs} onclick="event.preventDefault();var el=document.getElementById('${bookingNavTarget}');if(el){el.scrollIntoView({behavior:'smooth'});}else if(window.navigateTo){window.navigateTo('${bookingNavTarget}');}">${inner}</a>`;
      }
      return match;
    });

    // FIX 3: Google Maps
    const businessAddress = userInput?.businessAddress || "";
    if (businessAddress && process.env.GOOGLE_MAPS_API_KEY) {
      const mapsEmbed = `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`;
      // Skip if map already present
      if (!html.includes('maps.google') && !html.includes('maps.embed')) {
        // Strategy 1: Replace MAP PLACEHOLDER divs Stitch generates
        let mapInjected = false;
        const beforeLen = html.length;
        html = html.replace(/<div[^>]*>\s*MAP PLACEHOLDER[^<]*<\/div>/gi, mapsEmbed);
        if (html.length !== beforeLen) mapInjected = true;
        // Strategy 2: Replace empty map/location divs
        if (!mapInjected) {
          html = html.replace(/<div([^>]*(?:id|class)="[^"]*(?:map|location|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/div>/gi, (match: string, attrs: string) => {
            if (match.includes('iframe')) return match;
            mapInjected = true;
            return `<div${attrs}>${mapsEmbed}</div>`;
          });
        }
        // Strategy 3: inject inside contact section before its last closing div
        if (!mapInjected) {
          html = html.replace(/(<section[^>]*(?:id|class)="[^"]*contact[^"]*"[^>]*>)([\s\S]*?)(<\/section>)/gi, (_match: string, open: string, body: string, close: string) => {
            // Inject before the last closing </div> inside the section body
            const lastDiv = body.lastIndexOf('</div>');
            if (lastDiv !== -1) {
              return open + body.slice(0, lastDiv) + mapsEmbed + body.slice(lastDiv) + close;
            }
            return open + body + mapsEmbed + close;
          });
        }
      }
    }

    // FIX 4: Strip Calendly
    html = html.replace(/<script[^>]*calendly[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<link[^>]*calendly[^>]*/gi, '');

    // ── Re-inject essentials + images ─────────────────────────────────────────
    const { html: checkedHtml } = checkAndFixLinks(
      html,
      Array.isArray(userInput?.pages) ? userInput.pages : []
    );
    const ga4Id = job.ga4Id || userInput?.ga4Id || "";
    html = injectEssentials(checkedHtml, clientEmail, clientPhone, jobId, ga4Id);
    html = injectImages(html, logoUrl, heroUrl, photoUrls, productsWithPhotos);

    // ── Re-inject booking widget ───────────────────────────────────────────────
    if (hasBookingFeature) {
      try {
        const services = getServicesForIndustry(userInput?.industry || "");
        // Extract accent color from Stitch HTML
        let accentColor = "#D4AF37";
        const ctaBgMatch = html.match(/(?:class="[^"]*(?:btn|button|cta)[^"]*"[^>]*|id="[^"]*(?:cta|btn)[^"]*"[^>]*)style="[^"]*background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
        if (ctaBgMatch?.[1]) accentColor = ctaBgMatch[1];
        else {
          const cssVarMatch = html.match(/--(?:primary|accent|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/);
          if (cssVarMatch?.[1]) accentColor = cssVarMatch[1];
        }
        const bookingWidgetHtml = generateBookingWidget({
          jobId,
          businessName: userInput?.businessName || "",
          timezone: "Australia/Brisbane",
          services,
          primaryColor: accentColor,
          apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au",
        });
        html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*)\bid="booking"[^>]*>[\s\S]*?<\/\1>/gi, '<div id="booking"></div>');
        if (html.includes('id="booking"')) {
          html = html.replace('<div id="booking"></div>', bookingWidgetHtml);
        } else {
          html = html.replace("</body>", bookingWidgetHtml + "\n</body>");
        }
      } catch (e) {
        console.error("[Fix] Booking widget injection failed:", e);
      }
    }

    // ── Deploy to Vercel (stable URL) ─────────────────────────────────────────
    const vercelProjectName = job.vercelProjectName || ("wg-" + (job.domainSlug || jobId.slice(0, 40))).slice(0, 52);
    const stableUrl = await deployToVercel(html, vercelProjectName);
    console.log(`[Fix] Deployed to stable URL: ${stableUrl}`);

    // ── Save to Redis ─────────────────────────────────────────────────────────
    await redis.set(`job:${jobId}`, { ...job, html, previewUrl: stableUrl, fixedAt: new Date().toISOString() }, { ex: 86400 * 30 });
    if (clientSlug) {
      const existingClient = await redis.get<any>(`client:${clientSlug}`);
      if (existingClient) {
        await redis.set(`client:${clientSlug}`, { ...existingClient, previewUrl: stableUrl });
      }
    }

    // ── Email owner ───────────────────────────────────────────────────────────
    try {
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `🔧 Fix Complete — ${userInput?.businessName}`,
        html: `<!DOCTYPE html><html><body style="margin:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:#f59e0b;padding:24px 32px;"><h1 style="margin:0;color:#000;font-size:20px;">Fix Pass Complete</h1>
  <p style="margin:4px 0 0;color:rgba(0,0,0,0.6);font-size:13px;">${userInput?.businessName} — code-only fix, design preserved</p></td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Links, contact details, CTA buttons and booking widget have been re-applied. The Stitch design is unchanged.</p>
    <a href="${stableUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;">View Fixed Site →</a>
  </td></tr>
</table></td></tr></table></body></html>`,
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
<h1>Fix Complete</h1><p>${userInput?.businessName} — code-only pass applied, design preserved. Deployed to stable URL.</p>
<a href="${stableUrl}" target="_blank">View Fixed Site →</a></div></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

  } catch (err) {
    console.error("[Fix] Error:", err);
    return new Response(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 });
  }
}
