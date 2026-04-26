import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";
import { generateBookingWidget } from "@/lib/booking-widget";

export const maxDuration = 300;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationResult {
  status: "ok" | "skipped" | "error";
  embedCode?: string;
  error?: string;
  data?: Record<string, unknown>;
}

interface AvailabilityConfig {
  jobId: string;
  businessName: string;
  clientEmail: string;
  timezone: string;
  days: number[];
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxDaysAhead: number;
  services: { name: string; duration: number }[];
}

// ─── Slot duration & services by industry ────────────────────────────────────

const SLOT_DURATIONS: Record<string, number> = {
  medical: 30, health: 30, dental: 45, psychology: 50,
  legal: 60, accounting: 60, financial: 60,
  beauty: 45, hair: 45, spa: 60, fitness: 60,
  "personal training": 60, cleaning: 120,
  trades: 60, plumbing: 60, electrical: 60,
  consulting: 60, coaching: 60, photography: 120,
  default: 60,
};

function getSlotDuration(industry: string): number {
  const lower = industry.toLowerCase();
  for (const [key, val] of Object.entries(SLOT_DURATIONS)) {
    if (key !== "default" && lower.includes(key)) return val;
  }
  return SLOT_DURATIONS.default;
}

function getServicesForIndustry(industry: string): { name: string; duration: number }[] {
  const lower = industry.toLowerCase();
  const dur = getSlotDuration(industry);

  if (lower.includes("beauty") || lower.includes("hair") || lower.includes("salon")) {
    return [
      { name: "Appointment", duration: dur },
      { name: "Consultation", duration: 30 },
    ];
  }
  if (lower.includes("dental") || lower.includes("medical") || lower.includes("health")) {
    return [
      { name: "Initial Consultation", duration: dur },
      { name: "Follow-up Appointment", duration: 30 },
      { name: "General Appointment", duration: dur },
    ];
  }
  if (lower.includes("legal") || lower.includes("accounting") || lower.includes("financial")) {
    return [
      { name: "Initial Consultation", duration: dur },
      { name: "Ongoing Appointment", duration: dur },
    ];
  }
  if (lower.includes("trade") || lower.includes("plumb") || lower.includes("electric") || lower.includes("clean")) {
    return [
      { name: "Initial Consultation", duration: dur },
      { name: "Quote Visit", duration: 60 },
      { name: "Service Appointment", duration: dur },
    ];
  }
  if (lower.includes("photo") || lower.includes("studio")) {
    return [
      { name: "Portrait Session", duration: dur },
      { name: "Event Photography", duration: 120 },
      { name: "Consultation", duration: 30 },
    ];
  }
  if (lower.includes("fitness") || lower.includes("training") || lower.includes("gym")) {
    return [
      { name: "Personal Training Session", duration: dur },
      { name: "Initial Assessment", duration: 45 },
    ];
  }
  if (lower.includes("coach") || lower.includes("consult")) {
    return [
      { name: "Coaching Session", duration: dur },
      { name: "Discovery Call", duration: 30 },
    ];
  }
  if (lower.includes("spa") || lower.includes("massage") || lower.includes("wellness")) {
    return [
      { name: "Treatment Session", duration: dur },
      { name: "Consultation", duration: 30 },
    ];
  }
  return [
    { name: "Appointment", duration: dur },
    { name: "Consultation", duration: 30 },
  ];
}

// ─── Integration: Booking System ─────────────────────────────────────────────

async function setupBookingSystem(
  jobId: string,
  businessName: string,
  clientEmail: string,
  industry: string,
  timezone: string
): Promise<string> {
  const slotDuration = getSlotDuration(industry);
  const services = getServicesForIndustry(industry);

  const availabilityConfig: AvailabilityConfig = {
    jobId,
    businessName,
    clientEmail,
    timezone: timezone || "Australia/Brisbane",
    days: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 17,
    slotDurationMinutes: slotDuration,
    bufferMinutes: 15,
    maxDaysAhead: 30,
    services,
  };

  await redis.set(`availability:${jobId}`, availabilityConfig);

  const widgetHtml = generateBookingWidget({
    jobId,
    businessName,
    timezone: availabilityConfig.timezone,
    services,
    primaryColor: "#10b981",
    apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app",
  });

  return widgetHtml;
}

// ─── Integration: Web3Forms ───────────────────────────────────────────────────

async function provisionWeb3Forms(
  businessName: string,
  email: string
): Promise<IntegrationResult> {
  try {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      return {
        status: "skipped",
        embedCode: `<!-- Web3Forms contact form (WEB3FORMS_ACCESS_KEY not set) -->
<form action="https://api.web3forms.com/submit" method="POST" class="contact-form">
  <input type="hidden" name="access_key" value="YOUR_WEB3FORMS_KEY" />
  <input type="hidden" name="subject" value="New enquiry from ${businessName}" />
  <input type="hidden" name="from_name" value="${businessName}" />
  <input type="text" name="botcheck" style="display:none" />
  <div><label>Name</label><input type="text" name="name" required /></div>
  <div><label>Email</label><input type="email" name="email" required /></div>
  <div><label>Message</label><textarea name="message" required></textarea></div>
  <button type="submit">Send Message</button>
</form>`,
      };
    }

    const embedCode = `<!-- Web3Forms Contact Form for ${businessName} -->
<form action="https://api.web3forms.com/submit" method="POST" class="contact-form">
  <input type="hidden" name="access_key" value="${accessKey}" />
  <input type="hidden" name="subject" value="New enquiry from ${businessName}" />
  <input type="hidden" name="from_name" value="${businessName}" />
  <input type="hidden" name="ccemail" value="${email}" />
  <input type="text" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" />
  <div class="form-group"><label>Your Name</label><input type="text" name="name" required placeholder="Jane Smith" /></div>
  <div class="form-group"><label>Email Address</label><input type="email" name="email" required placeholder="jane@example.com" /></div>
  <div class="form-group"><label>Phone</label><input type="tel" name="phone" placeholder="0400 000 000" /></div>
  <div class="form-group"><label>Message</label><textarea name="message" required rows="4" placeholder="How can we help?"></textarea></div>
  <button type="submit" class="submit-btn">Send Message</button>
</form>`;

    return { status: "ok", embedCode };
  } catch (err) {
    return { status: "error", error: String(err) };
  }
}

// ─── Integration: Google Maps ─────────────────────────────────────────────────

async function provisionGoogleMaps(
  businessAddress: string,
  businessName: string
): Promise<IntegrationResult> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        status: "skipped",
        embedCode: `<!-- Google Maps embed (GOOGLE_MAPS_API_KEY not set) -->
<div class="map-placeholder" style="background:#1a1a2e;border-radius:12px;padding:40px;text-align:center;color:#64748b;">
  <p>📍 ${businessAddress || businessName}</p>
  <p style="font-size:0.85rem;">Map embed requires Google Maps API key</p>
</div>`,
      };
    }

    const encodedAddress = encodeURIComponent(businessAddress || businessName);
    const embedCode = `<!-- Google Maps for ${businessName} -->
<div class="map-container" style="border-radius:12px;overflow:hidden;">
  <iframe
    width="100%"
    height="400"
    style="border:0;display:block;"
    loading="lazy"
    allowfullscreen
    referrerpolicy="no-referrer-when-downgrade"
    src="https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}">
  </iframe>
</div>`;

    return { status: "ok", embedCode };
  } catch (err) {
    return { status: "error", error: String(err) };
  }
}

// ─── Integration: Tawk.to ─────────────────────────────────────────────────────

async function provisionTawkTo(
  businessName: string,
  email: string
): Promise<IntegrationResult> {
  try {
    const apiKey = process.env.TAWK_API_KEY;
    if (!apiKey) {
      return {
        status: "skipped",
        embedCode: `<!-- Tawk.to live chat (TAWK_API_KEY not set) -->
<!-- Replace YOUR_PROPERTY_ID and YOUR_WIDGET_ID with actual values from tawk.to -->
<script type="text/javascript">
  var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
  (function(){
    var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
    s1.async=true;
    s1.src='https://embed.tawk.to/YOUR_PROPERTY_ID/YOUR_WIDGET_ID';
    s1.charset='UTF-8';
    s1.setAttribute('crossorigin','*');
    s0.parentNode.insertBefore(s1,s0);
  })();
</script>`,
      };
    }

    const domain = email.split("@")[1] || "example.com";

    let propertyId = "";
    try {
      const resp = await fetch("https://api.tawk.to/v1/property", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + Buffer.from(`${apiKey}:f`).toString("base64"),
        },
        body: JSON.stringify({ name: businessName, domain }),
      });
      const data = await resp.json();
      propertyId = data?.data?._id || data?._id || "";
    } catch {
      // Fall through with empty propertyId
    }

    const embedCode = propertyId
      ? `<!-- Tawk.to Live Chat for ${businessName} -->
<script type="text/javascript">
  var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
  (function(){
    var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
    s1.async=true;
    s1.src='https://embed.tawk.to/${propertyId}/default';
    s1.charset='UTF-8';
    s1.setAttribute('crossorigin','*');
    s0.parentNode.insertBefore(s1,s0);
  })();
</script>`
      : `<!-- Tawk.to Live Chat for ${businessName} (manual setup needed) -->
<script type="text/javascript">
  var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
  (function(){
    var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
    s1.async=true;
    s1.src='https://embed.tawk.to/PROPERTY_ID/default';
    s1.charset='UTF-8';
    s1.setAttribute('crossorigin','*');
    s0.parentNode.insertBefore(s1,s0);
  })();
</script>`;

    return { status: "ok", embedCode, data: { propertyId } };
  } catch (err) {
    return { status: "error", error: String(err) };
  }
}

// ─── Integration: MailerLite ──────────────────────────────────────────────────

async function provisionMailerLite(businessName: string): Promise<IntegrationResult> {
  try {
    const apiKey = process.env.MAILERLITE_API_KEY;
    if (!apiKey) {
      return {
        status: "skipped",
        embedCode: `<!-- Newsletter signup form (MAILERLITE_API_KEY not set) -->
<form class="newsletter-form" onsubmit="event.preventDefault(); alert('Newsletter signup coming soon!');">
  <div class="newsletter-group">
    <input type="email" name="email" required placeholder="Your email address" class="newsletter-input" />
    <button type="submit" class="newsletter-btn">Subscribe</button>
  </div>
  <p style="font-size:0.8rem;color:#64748b;margin-top:8px;">Stay updated with ${businessName} news and offers.</p>
</form>`,
      };
    }

    let groupId = "";
    try {
      const resp = await fetch("https://connect.mailerlite.com/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: `${businessName} Subscribers` }),
      });
      const data = await resp.json();
      groupId = data?.data?.id || data?.id || "";
    } catch {
      // Fall through
    }

    const embedCode = groupId
      ? `<!-- MailerLite Newsletter Signup for ${businessName} -->
<form class="newsletter-form" onsubmit="handleNewsletterSubmit(event, '${groupId}')">
  <div class="newsletter-group" style="display:flex;gap:8px;flex-wrap:wrap;">
    <input type="email" id="nl-email" required placeholder="Your email address" style="flex:1;min-width:200px;padding:12px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:#0a0f1a;color:#e2e8f0;" />
    <button type="submit" style="padding:12px 24px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Subscribe</button>
  </div>
  <p id="nl-msg" style="font-size:0.8rem;margin-top:8px;color:#64748b;">Stay updated with ${businessName} news and offers.</p>
</form>
<script>
async function handleNewsletterSubmit(e, groupId) {
  e.preventDefault();
  var email = document.getElementById('nl-email').value;
  var msg = document.getElementById('nl-msg');
  msg.textContent = 'Subscribing...';
  try {
    var r = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${apiKey}' },
      body: JSON.stringify({ email: email, groups: [groupId] })
    });
    if (r.ok) { msg.textContent = 'You\\'re subscribed! Thank you.'; msg.style.color = '#10b981'; }
    else { msg.textContent = 'Something went wrong. Please try again.'; msg.style.color = '#ef4444'; }
  } catch { msg.textContent = 'Network error. Please try again.'; msg.style.color = '#ef4444'; }
}
</script>`
      : `<!-- MailerLite Newsletter Signup for ${businessName} -->
<form class="newsletter-form" onsubmit="event.preventDefault(); this.querySelector('.nl-msg').textContent = 'Thank you for subscribing!';">
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <input type="email" required placeholder="Your email address" style="flex:1;min-width:200px;padding:12px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:#0a0f1a;color:#e2e8f0;" />
    <button type="submit" style="padding:12px 24px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Subscribe</button>
  </div>
  <p class="nl-msg" style="font-size:0.8rem;margin-top:8px;color:#64748b;">Stay updated with ${businessName} news and offers.</p>
</form>`;

    return { status: "ok", embedCode, data: { groupId } };
  } catch (err) {
    return { status: "error", error: String(err) };
  }
}

// ─── Integration: Stripe (DORMANT) ───────────────────────────────────────────

// Stripe dormant — activate when ready
async function provisionStripe(businessName: string): Promise<IntegrationResult> {
  void businessName;
  return {
    status: "skipped",
    embedCode: `<!-- Stripe Buy Button (activate when ready) -->
<div class="stripe-placeholder" style="background:#0a0f1a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;text-align:center;">
  <p style="color:#64748b;margin:0 0 12px;">🛒 Online payments coming soon</p>
  <button disabled style="padding:12px 24px;background:#635BFF;color:#fff;border:none;border-radius:8px;font-weight:600;opacity:0.5;cursor:not-allowed;">Pay Now</button>
</div>`,
  };
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      { folder, resource_type: "auto" },
      (err, result) => {
        if (err || !result) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCSS(html: string): { html: string; css: string } {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssBlocks: string[] = [];
  const strippedHtml = html.replace(styleRegex, (_, content) => {
    cssBlocks.push(content);
    return "";
  });
  return { html: strippedHtml, css: cssBlocks.join("\n") };
}

function checkLinks(html: string): { html: string; report: string[] } {
  const report: string[] = [];
  const fixed = html
    .replace(/href="(tel:|mailto:|https?:\/\/|#[a-zA-Z0-9-_]+)"/g, (m) => m)
    .replace(/href="([^"#](?!tel:|mailto:|https?:\/\/)[^"]*?)"/g, (match, href) => {
      if (!href.startsWith("#")) {
        report.push(`Suspicious href: ${href}`);
      }
      return match;
    });
  return { html: fixed, report };
}

function injectEssentials(html: string, meta: { title: string; description: string; url: string }): string {
  if (!html.includes("<meta charset")) {
    html = html.replace(
      "<head>",
      `<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${meta.description}" />
  <meta property="og:title" content="${meta.title}" />
  <meta property="og:description" content="${meta.description}" />
  <meta property="og:url" content="${meta.url}" />
  <title>${meta.title}</title>`
    );
  }
  return html;
}

function injectImages(
  html: string,
  images: { logoUrl?: string; heroUrl?: string; photoUrls?: string[] }
): string {
  let result = html;
  if (images.logoUrl) {
    result = result.replace(
      /src="[^"]*logo[^"]*placeholder[^"]*"/gi,
      `src="${images.logoUrl}"`
    );
  }
  if (images.heroUrl) {
    result = result.replace(
      /src="[^"]*hero[^"]*placeholder[^"]*"/gi,
      `src="${images.heroUrl}"`
    );
  }
  return result;
}

function injectWatermark(html: string): string {
  const watermark = `
<!-- WebGecko Watermark -->
<div style="position:fixed;bottom:12px;right:12px;z-index:9999;opacity:0.7;">
  <a href="https://webgecko.au" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;text-decoration:none;background:rgba(10,15,26,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 12px;backdrop-filter:blur(8px);">
    <span style="font-size:14px;">🦎</span>
    <span style="color:#ffffff;font-size:11px;font-family:sans-serif;font-weight:600;letter-spacing:0.03em;">Built by WebGecko</span>
  </a>
</div>`;
  return html.replace("</body>", `${watermark}\n</body>`);
}

async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

async function deployToVercel(
  html: string,
  projectName: string
): Promise<{ url: string; deploymentId: string }> {
  const safeProjectName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const uniqueName = `${safeProjectName}-${Date.now()}`;

  const deployResp = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: uniqueName,
      teamId: process.env.VERCEL_TEAM_ID,
      files: [
        {
          file: "index.html",
          data: html,
          encoding: "utf-8",
        },
      ],
      projectSettings: {
        framework: null,
        outputDirectory: "./",
      },
    }),
  });

  if (!deployResp.ok) {
    const err = await deployResp.text();
    throw new Error(`Vercel deployment failed: ${err}`);
  }

  const deploy = await deployResp.json();
  const url = `https://${deploy.url}`;
  return { url, deploymentId: deploy.id };
}

// ─── Quote calculator ─────────────────────────────────────────────────────────

function calculateQuote(pages: string[], features: string[], siteType: string) {
  let packageName = "Starter";
  let basePrice = 1800;
  let competitorPrice = 3500;
  let monthlyPrice = 79;

  const hasEcom = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const pageCount = pages.length;
  const isMulti = siteType === "multi";

  if (pageCount >= 8 || hasEcom) {
    packageName = "Premium";
    basePrice = 5500;
    competitorPrice = 15000;
    monthlyPrice = 149;
  } else if (pageCount >= 4 || isMulti || hasBooking) {
    packageName = "Business";
    basePrice = 3200;
    competitorPrice = 7500;
    monthlyPrice = 99;
  }

  let addOns = 0;
  if (hasEcom) addOns += 300;
  if (hasBooking) addOns += 200;
  if (features.includes("Blog")) addOns += 150;
  if (features.includes("Photo Gallery")) addOns += 100;
  if (features.includes("Reviews & Testimonials")) addOns += 100;
  if (features.includes("Live Chat")) addOns += 150;
  if (features.includes("Newsletter Signup")) addOns += 100;

  const totalPrice = basePrice + addOns;
  const deposit = Math.round(totalPrice / 2);
  const savings = competitorPrice - totalPrice;

  return { packageName, totalPrice, monthlyPrice, savings, competitorPrice, deposit };
}

// ─── Email builders ───────────────────────────────────────────────────────────

function buildOwnerEmail(params: {
  jobId: string;
  businessName: string;
  name: string;
  email: string;
  phone: string;
  abn: string;
  industry: string;
  goal: string;
  siteType: string;
  pages: string[];
  features: string[];
  quote: ReturnType<typeof calculateQuote>;
  previewUrl: string;
  integrations: Record<string, IntegrationResult>;
  hasBooking: boolean;
}): string {
  const {
    jobId, businessName, name, email, phone, abn, industry, goal,
    siteType, pages, features, quote, previewUrl, integrations, hasBooking,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
  const secret = process.env.PROCESS_SECRET || "";

  const bookingSection = hasBooking
    ? `<tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Booking System</span>
        <p style="color:#10b981;margin:4px 0 0;font-weight:600;">✅ Active</p>
        <p style="margin:6px 0 0;"><a href="${baseUrl}/api/bookings?jobId=${jobId}&secret=${encodeURIComponent(secret)}" style="color:#10b981;font-size:13px;">View all bookings →</a></p>
        <p style="color:#64748b;font-size:12px;margin:6px 0 0;">Default: Mon–Fri, 9am–5pm, 60-min slots</p>
        <p style="color:#475569;font-size:11px;margin:4px 0 0;">Client can adjust availability by contacting you</p>
      </td></tr>`
    : "";

  const integrationRows = Object.entries(integrations)
    .map(([key, val]) => {
      const statusColor = val.status === "ok" ? "#10b981" : val.status === "skipped" ? "#f59e0b" : "#ef4444";
      return `<tr><td style="padding:8px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="color:#64748b;font-size:12px;">${key}</span>
        <span style="color:${statusColor};font-size:12px;float:right;">${val.status}</span>
      </td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:#10b981;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;">🦎 New WebGecko Job</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Job ID: ${jobId}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#e2e8f0;margin:0 0 20px;font-size:18px;">${businessName}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Contact</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">${name} · ${email} · ${phone}</p>
              ${abn ? `<p style="color:#64748b;font-size:12px;margin:2px 0 0;">ABN: ${abn}</p>` : ""}
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Industry</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">${industry}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Goal</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">${goal}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Site Type</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">${siteType} · ${pages.length} pages</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;">Features</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">${features.join(", ") || "None"}</p>
            </td></tr>
            ${bookingSection}
          </table>

          <h3 style="color:#e2e8f0;margin:0 0 12px;font-size:15px;">Quote</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:#64748b;">Package</span><span style="color:#10b981;float:right;font-weight:600;">${quote.packageName}</span>
            </td></tr>
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:#64748b;">Total</span><span style="color:#e2e8f0;float:right;font-weight:700;">$${quote.totalPrice.toLocaleString()}</span>
            </td></tr>
            <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="color:#64748b;">Deposit</span><span style="color:#e2e8f0;float:right;">$${quote.deposit.toLocaleString()}</span>
            </td></tr>
            <tr><td style="padding:12px 20px;">
              <span style="color:#64748b;">Monthly</span><span style="color:#e2e8f0;float:right;">$${quote.monthlyPrice}/mo</span>
            </td></tr>
          </table>

          <h3 style="color:#e2e8f0;margin:0 0 12px;font-size:15px;">Integrations</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            ${integrationRows}
          </table>

          <div style="text-align:center;margin-top:24px;">
            <a href="${previewUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">View Website Preview →</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#475569;font-size:12px;margin:0;">WebGecko Automated Pipeline · Job ${jobId}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildClientEmail(params: {
  name: string;
  businessName: string;
  email: string;
  quote: ReturnType<typeof calculateQuote>;
  previewUrl: string;
  hasBooking: boolean;
}): string {
  const { name, businessName, email, quote, previewUrl, hasBooking } = params;
  const firstName = name.split(" ")[0];

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;">Your website is being built! 🚀</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Hi ${firstName}, welcome to WebGecko</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#e2e8f0;margin:0 0 20px;">We've received your submission for <strong>${businessName}</strong> and our AI-powered build pipeline has been kicked off. Here's what to expect:</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#10b981;font-weight:600;">Package</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:18px;font-weight:700;">${quote.packageName} — $${quote.totalPrice.toLocaleString()}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:13px;">Deposit required</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-weight:600;">$${quote.deposit.toLocaleString()}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:13px;">Monthly hosting & support</span>
              <p style="color:#e2e8f0;margin:4px 0 0;">$${quote.monthlyPrice}/month</p>
            </td></tr>
          </table>

          ${hasBooking ? `<div style="background:#052e16;border:1px solid #10b981;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#10b981;margin:0 0 6px;font-weight:600;">📅 Booking System Included</p>
            <p style="color:#94a3b8;font-size:13px;margin:0;">Your site will include an online booking system so customers can book appointments directly. We'll set up your availability schedule as part of the build.</p>
          </div>` : ""}

          <div style="text-align:center;margin-bottom:24px;">
            <a href="${previewUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">View Your Website Preview →</a>
          </div>

          <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Questions? Contact us:</p>
          <p style="color:#94a3b8;font-size:13px;margin:0;">📧 hello@webgecko.au &nbsp;·&nbsp; 📞 1300 WEBGECKO</p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#475569;font-size:12px;margin:0;">Didn't expect this email? It may have been submitted on your behalf. Contact hello@webgecko.au if you have concerns.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Parse fields
    const turnstileToken = formData.get("turnstileToken") as string;
    const businessName = (formData.get("businessName") as string) || "";
    const industry = (formData.get("industry") as string) || "";
    const usp = (formData.get("usp") as string) || "";
    const existingWebsite = (formData.get("existingWebsite") as string) || "";
    const targetAudience = (formData.get("targetAudience") as string) || "";
    const businessAddress = (formData.get("businessAddress") as string) || "";
    const goal = (formData.get("goal") as string) || "";
    const siteType = (formData.get("siteType") as string) || "single";
    const hasPricing = (formData.get("hasPricing") as string) || "No";
    const pricingType = (formData.get("pricingType") as string) || "";
    const pricingMethod = (formData.get("pricingMethod") as string) || "";
    const pricingDetails = (formData.get("pricingDetails") as string) || "";
    const pricingUrl = (formData.get("pricingUrl") as string) || "";
    const style = (formData.get("style") as string) || "";
    const colorPrefs = (formData.get("colorPrefs") as string) || "";
    const references = (formData.get("references") as string) || "";
    const hasLogo = (formData.get("hasLogo") as string) || "No";
    const hasContent = (formData.get("hasContent") as string) || "No";
    const additionalNotes = (formData.get("additionalNotes") as string) || "";
    const name = (formData.get("name") as string) || "";
    const email = (formData.get("email") as string) || "";
    const phone = (formData.get("phone") as string) || "";
    const abn = (formData.get("abn") as string) || "";

    let pages: string[] = [];
    let features: string[] = [];
    let products: unknown[] = [];
    try { pages = JSON.parse((formData.get("pages") as string) || "[]"); } catch { pages = []; }
    try { features = JSON.parse((formData.get("features") as string) || "[]"); } catch { features = []; }
    try { products = JSON.parse((formData.get("products") as string) || "[]"); } catch { products = []; }
    void products;

    console.log(`\n🚀 PIPELINE STARTED: ${businessName}`);
    // Verify Turnstile
    console.log(`🔐 STEP 1: Verifying Turnstile...`);
    if (turnstileToken) {
      const valid = await verifyTurnstile(turnstileToken);
      if (!valid) {
        return Response.json({ error: "Security check failed. Please refresh and try again." }, { status: 400 });
      }
    }

    const jobId = crypto.randomUUID();

    // Upload images to Cloudinary
    const imageUploads: Record<string, string> = {};
    const uploadFolder = `webgecko/${businessName}`;

    const logoFile = formData.get("logo") as File | null;
    const heroFile = formData.get("hero") as File | null;

    const uploadPromises: Promise<void>[] = [];

    if (logoFile && logoFile.size > 0) {
      uploadPromises.push(
        uploadToCloudinary(logoFile, uploadFolder)
          .then(({ url }) => { imageUploads.logo = url; })
          .catch((e) => console.error("Logo upload failed:", e))
      );
    }

    if (heroFile && heroFile.size > 0) {
      uploadPromises.push(
        uploadToCloudinary(heroFile, uploadFolder)
          .then(({ url }) => { imageUploads.hero = url; })
          .catch((e) => console.error("Hero upload failed:", e))
      );
    }

    for (let i = 0; i < 5; i++) {
      const photoFile = formData.get(`photo_${i}`) as File | null;
      if (photoFile && photoFile.size > 0) {
        const idx = i;
        uploadPromises.push(
          uploadToCloudinary(photoFile, uploadFolder)
            .then(({ url }) => { imageUploads[`photo_${idx}`] = url; })
            .catch((e) => console.error(`Photo ${idx} upload failed:`, e))
        );
      }
    }

    for (let i = 0; i < 12; i++) {
      const ppFile = formData.get(`product_photo_${i}`) as File | null;
      if (ppFile && ppFile.size > 0) {
        const idx = i;
        uploadPromises.push(
          uploadToCloudinary(ppFile, `${uploadFolder}/products`)
            .then(({ url }) => { imageUploads[`product_photo_${idx}`] = url; })
            .catch((e) => console.error(`Product photo ${idx} upload failed:`, e))
        );
      }
    }

    const pricingSheetFile = formData.get("pricing_sheet") as File | null;
    if (pricingSheetFile && pricingSheetFile.size > 0) {
      uploadPromises.push(
        uploadToCloudinary(pricingSheetFile, uploadFolder)
          .then(({ url }) => { imageUploads.pricing_sheet = url; })
          .catch((e) => console.error("Pricing sheet upload failed:", e))
      );
    }

    console.log(`\n⚙️ STEP 3: Provisioning integrations... Features: ${features.join(", ") || "none"}`);
    // Provision integrations in parallel (step 4)
    const timezone = "Australia/Brisbane";

    const [
      web3formsResult,
      googleMapsResult,
      tawkToResult,
      mailerLiteResult,
      stripeResult,
    ] = await Promise.all([
      ...(features.some((f) => ["Contact Form", "Social Media Links"].includes(f))
        ? [provisionWeb3Forms(businessName, email)]
        : [Promise.resolve<IntegrationResult>({ status: "skipped" })]),
      ...(features.includes("Google Maps")
        ? [provisionGoogleMaps(businessAddress, businessName)]
        : [Promise.resolve<IntegrationResult>({ status: "skipped" })]),
      ...(features.includes("Live Chat")
        ? [provisionTawkTo(businessName, email)]
        : [Promise.resolve<IntegrationResult>({ status: "skipped" })]),
      ...(features.includes("Newsletter Signup")
        ? [provisionMailerLite(businessName)]
        : [Promise.resolve<IntegrationResult>({ status: "skipped" })]),
      provisionStripe(businessName),
    ]);

    await Promise.all(uploadPromises);

    // Booking system setup
    let bookingWidgetHtml = "";
    const hasBooking = features.includes("Booking System");
    if (hasBooking) {
      try {
        bookingWidgetHtml = await setupBookingSystem(jobId, businessName, email, industry, timezone);
      } catch (e) {
        console.error("Booking system setup failed:", e);
      }
    }

    const integrations: Record<string, IntegrationResult> = {
      "Contact Form": web3formsResult,
      "Google Maps": googleMapsResult,
      "Live Chat": tawkToResult,
      "Newsletter Signup": mailerLiteResult,
      "Stripe": stripeResult,
    };

    if (hasBooking) {
      integrations["Booking System"] = { status: bookingWidgetHtml ? "ok" : "error" };
    }

    // Build embed summary for Claude pass 2
    const embedSummary: string[] = [];
    if (web3formsResult.status === "ok" && web3formsResult.embedCode) {
      embedSummary.push(`CONTACT FORM:\n${web3formsResult.embedCode}`);
    }
    if (googleMapsResult.status === "ok" && googleMapsResult.embedCode) {
      embedSummary.push(`GOOGLE MAPS:\n${googleMapsResult.embedCode}`);
    }
    if (tawkToResult.status === "ok" && tawkToResult.embedCode) {
      embedSummary.push(`LIVE CHAT SCRIPT (inject before </body>):\n${tawkToResult.embedCode}`);
    }
    if (mailerLiteResult.status === "ok" && mailerLiteResult.embedCode) {
      embedSummary.push(`NEWSLETTER SIGNUP FORM:\n${mailerLiteResult.embedCode}`);
    }
    if (hasBooking && bookingWidgetHtml) {
      embedSummary.push(`BOOKING WIDGET (inject into booking section):\n${bookingWidgetHtml}`);
    }

    const pricingContext = hasPricing === "Yes"
      ? `Pricing: ${pricingType}. Method: ${pricingMethod}. Details: ${pricingDetails}. URL: ${pricingUrl}.`
      : "No pricing to display.";

    const logoContext = imageUploads.logo ? `Logo URL: ${imageUploads.logo}` : (hasLogo === "Yes" ? "Client has a logo but it wasn't uploaded." : "No logo.");
    const heroContext = imageUploads.hero ? `Hero image URL: ${imageUploads.hero}` : "No hero image uploaded.";
    const photoContext = Object.entries(imageUploads)
      .filter(([k]) => k.startsWith("photo_"))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    console.log(`\n🤖 STEP 4: Claude pass 1 — generating design brief...`);
    // Claude pass 1: Generate Stitch prompt
    let stitchPromptRaw = "";
    let projectTitle = businessName;

    try {
      const pass1 = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `You are a senior web design director. Generate a design brief for a world-class website for this business.

Business: ${businessName}
Industry: ${industry}
USP: ${usp}
Target Audience: ${targetAudience}
Goal: ${goal}
Site Type: ${siteType} (${pages.join(", ")})
Style: ${style}
Color Preferences: ${colorPrefs}
Reference Sites: ${references}
${pricingContext}
${logoContext}
${heroContext}
Additional Notes: ${additionalNotes}

Return ONLY valid JSON (no markdown, no backticks) in this exact shape:
{
  "projectTitle": "SEO-friendly site title",
  "stitchPrompt": "detailed prompt for the site builder"
}

The stitchPrompt must specify:
- Full viewport hero section (60-80px headline, distinctive non-white dark background color)
- Sticky nav with hamburger menu (id="hamburger") that toggles mobile menu (id="mobile-menu")
- Mixed asymmetric section layouts (not just centered columns)
- Specific Google Font pairing and exact hex color scheme
- Stats bar with 3-4 trust signals (numbers, years, clients, etc.)
- ${siteType === "multi" ? "Multi-page divs with data-page attribute for each page section" : "Single page smooth scroll"}
- Real placeholder contact details (phone, email, address for ${businessAddress || industry + " business"})
- Sections for: ${pages.join(", ")}
- Features to include: ${features.join(", ")}
Make it distinctive and premium. No generic templates.`,
          },
        ],
      });

      const pass1Text = pass1.content.find((b) => b.type === "text")?.text || "{}";
      const cleaned = pass1Text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      projectTitle = parsed.projectTitle || businessName;
      stitchPromptRaw = parsed.stitchPrompt || "";
    } catch (e) {
      console.error("Claude pass 1 failed:", e);
      stitchPromptRaw = `Build a professional ${industry} website for ${businessName}. Include sections for: ${pages.join(", ")}. Style: ${style}. Dark themed with emerald accents.`;
    }

    console.log(`\n🌐 STEP 5: Google Stitch — generating HTML...`);
    // Google Stitch (HTML generation)
    let rawHtml = "";
    try {
      const stitchResp = await fetch("https://stitch.withgoogle.com/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.STITCH_API_KEY}`,
        },
        body: JSON.stringify({ prompt: stitchPromptRaw }),
      });

      console.log(`  Stitch status: ${stitchResp.status}`);
      if (stitchResp.ok) {
        const stitchData = await stitchResp.json();
        console.log(`  Stitch keys: ${Object.keys(stitchData).join(", ")}`);
        rawHtml = stitchData.html || stitchData.output || stitchData.result || stitchData.content || "";
        console.log(`  Stitch HTML length: ${rawHtml.length} chars`);
      } else {
        const errText = await stitchResp.text();
        console.log(`  Stitch error body: ${errText.slice(0, 500)}`);
      }

    if (!rawHtml) {
      rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${projectTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0f1a; color: #e2e8f0; font-family: 'Inter', sans-serif; }
  nav { position: sticky; top: 0; background: rgba(10,15,26,0.95); backdrop-filter: blur(12px); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .nav-logo { font-size: 1.3rem; font-weight: 700; color: #10b981; }
  .nav-links { display: flex; gap: 24px; list-style: none; }
  .nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.95rem; }
  .hamburger { display: none; background: none; border: none; color: #e2e8f0; font-size: 1.5rem; cursor: pointer; }
  .mobile-menu { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0a0f1a; z-index: 200; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
  .mobile-menu.open { display: flex; }
  .mobile-menu a { color: #e2e8f0; font-size: 1.5rem; text-decoration: none; }
  .hero { min-height: 100vh; display: flex; align-items: center; background: linear-gradient(135deg, #0a0f1a 0%, #0d1f17 100%); padding: 80px 24px; }
  .hero-content { max-width: 700px; }
  .hero h1 { font-size: clamp(3rem, 5vw, 5rem); font-weight: 800; color: #ffffff; line-height: 1.1; margin-bottom: 20px; }
  .hero p { font-size: 1.2rem; color: #94a3b8; margin-bottom: 32px; }
  .btn { display: inline-block; background: #10b981; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem; }
  .section { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .hamburger { display: block; }
  }
</style>
</head>
<body>
<nav>
  <div class="nav-logo">${businessName}</div>
  <ul class="nav-links">
    ${pages.map((p) => `<li><a href="#${p.toLowerCase().replace(/\s+/g, "-")}">${p}</a></li>`).join("")}
  </ul>
  <button class="hamburger" id="hamburger">☰</button>
</nav>
<div class="mobile-menu" id="mobile-menu">
  ${pages.map((p) => `<a href="#${p.toLowerCase().replace(/\s+/g, "-")}" onclick="document.getElementById('mobile-menu').classList.remove('open')">${p}</a>`).join("")}
</div>
<section class="hero">
  <div class="hero-content">
    <h1>${businessName}</h1>
    <p>${usp || `Professional ${industry} services you can trust`}</p>
    <a href="#contact" class="btn">Get Started</a>
  </div>
</section>
${pages.map((p) => `<section class="section" id="${p.toLowerCase().replace(/\s+/g, "-")}"><h2 style="color:#e2e8f0;font-size:2rem;margin-bottom:16px;">${p}</h2><p style="color:#94a3b8;">Content for ${p} section.</p></section>`).join("\n")}
<script>
  document.getElementById('hamburger').addEventListener('click', function() {
    document.getElementById('mobile-menu').classList.toggle('open');
  });
</script>
</body>
</html>`;
    }

    console.log(`\n🤖 STEP 6: Claude pass 2 — fixing HTML and injecting embeds...`);
    // Claude pass 2: Fix HTML, inject embed codes
    let finalHtml = rawHtml;
    try {
      const pass2 = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: `You are a senior frontend developer. Fix and enhance this HTML website for ${businessName}.

BUSINESS DETAILS:
- Name: ${businessName}
- Industry: ${industry}
- Address: ${businessAddress || "Contact us for address"}
- Email: ${email}
- Phone: ${phone}
- USP: ${usp}

TASKS:
1. Replace ALL placeholder text with real business details (name, phone, email, address)
2. Fix all dead href="#" links — use real anchor IDs or proper mailto:/tel: links
3. ${siteType === "multi" ? "Implement multi-page routing: wrap each page in <div data-page='pagename'>, show only active page, add nav click handlers" : "Ensure smooth scroll between sections"}
4. Fix hamburger menu: id='hamburger' toggles id='mobile-menu' visibility
5. Add proper meta tags (description, og:title, og:description, viewport, charset)
6. Add Google Fonts link in <head> if not present
7. Inject these embed codes into the correct sections of the page:

${embedSummary.length > 0 ? embedSummary.join("\n\n---\n\n") : "No embed codes to inject."}

${logoContext}
${heroContext}
${photoContext ? `Photos: ${photoContext}` : ""}

Return ONLY the complete, valid HTML document. No explanations, no markdown, no backticks. Start with <!DOCTYPE html>.`,
          },
        ],
      });

      const pass2Text = pass2.content.find((b) => b.type === "text")?.text || "";
      if (pass2Text.includes("<!DOCTYPE") || pass2Text.includes("<html")) {
        finalHtml = pass2Text.trim();
      }
    } catch (e) {
      console.error("Claude pass 2 failed:", e);
    }

    // Post-processing
    const { html: linkedHtml, report: linkReport } = checkLinks(finalHtml);
    const essentialHtml = injectEssentials(linkedHtml, {
      title: projectTitle,
      description: usp || `${businessName} — Professional ${industry} services`,
      url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app"}`,
    });
    const imagedHtml = injectImages(essentialHtml, {
      logoUrl: imageUploads.logo,
      heroUrl: imageUploads.hero,
      photoUrls: Object.entries(imageUploads)
        .filter(([k]) => k.startsWith("photo_"))
        .map(([, v]) => v),
    });
    const watermarkedHtml = injectWatermark(imagedHtml);

    console.log(`\n🚀 STEP 7: Deploying to Vercel...`);
    // Deploy to Vercel
    let previewUrl = "";
    let deploymentId = "";
    try {
      const deployment = await deployToVercel(watermarkedHtml, `${businessName}-${jobId}`);
      previewUrl = deployment.url;
      deploymentId = deployment.deploymentId;
      void deploymentId;
    } catch (e) {
      console.error("Vercel deploy failed:", e);
      previewUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/preview/${jobId}`;
    }

    // Calculate quote
    const quote = calculateQuote(pages, features, siteType);

    // Save to Redis (7 day TTL)
    const jobData = {
      jobId,
      businessName,
      industry,
      name,
      email,
      phone,
      abn,
      businessAddress,
      goal,
      siteType,
      pages,
      features,
      quote,
      integrations,
      previewUrl,
      html: watermarkedHtml,
      linkReport,
      payment_status: "pending",
      hasBooking,
      created_at: new Date().toISOString(),
    };

    try {
      await redis.set(`job:${jobId}`, jobData, { ex: 60 * 60 * 24 * 7 });
    } catch (e) {
      console.error("Redis save failed:", e);
    }

    console.log(`\n📧 STEP 9: Sending emails...`);
    console.log(`  Owner email → ${process.env.RESULT_TO_EMAIL}`);
    // Send owner email
    try {
      const ownerEmail = process.env.RESULT_TO_EMAIL || "hello@webgecko.au";
      await resend.emails.send({
        from: "WebGecko Pipeline <pipeline@webgecko.au>",
        to: ownerEmail,
        subject: `New Job: ${businessName} — ${quote.packageName} $${quote.totalPrice}`,
        html: buildOwnerEmail({
          jobId,
          businessName,
          name,
          email,
          phone,
          abn,
          industry,
          goal,
          siteType,
          pages,
          features,
          quote,
          previewUrl,
          integrations,
          hasBooking,
        }),
      });
    } catch (e) {
      console.error("Owner email failed:", e);
    }

    console.log(`  Client email → ${email}`);
    // Send client email
    try {
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: email,
        subject: `Your ${businessName} website is being built! 🚀`,
        html: buildClientEmail({ name, businessName, email, quote, previewUrl, hasBooking }),
      });
    } catch (e) {
      console.error("Client email failed:", e);
    }

    console.log(`\n✅ PIPELINE COMPLETE — jobId: ${jobId} | preview: ${previewUrl}`);
    return Response.json({
      success: true,
      jobId,
      previewUrl,
      quote,
      hasBooking,
    });
  } catch (err) {
    console.error("Worker pipeline error:", err);
    return Response.json({ error: "Pipeline failed. Please try again." }, { status: 500 });
  }
}
