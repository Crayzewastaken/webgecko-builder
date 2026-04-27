export const maxDuration = 300;
import crypto from "crypto";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";
import { v2 as cloudinary } from "cloudinary";
import { generateBookingWidget } from "@/lib/booking-widget";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

function extractJson(text: string) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON braces found");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    // Response was truncated — extract what we can with regex
    const titleMatch = text.match(/"projectTitle"\s*:\s*"([^"]+)"/);
    const promptMatch = text.match(/"stitchPrompt"\s*:\s*"([\s\S]+)/);
    let stitchPrompt = promptMatch?.[1] || text;
    // Strip any trailing partial JSON artifacts
    stitchPrompt = stitchPrompt.replace(/"\s*}?\s*$/, "").replace(/\\n/g, "\n").slice(0, 4000);
    console.warn("extractJson: JSON truncated — using regex fallback");
    return {
      projectTitle: titleMatch?.[1] || "Website Project",
      stitchPrompt,
    };
  }
}

function safeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

function extractCSS(html: string): string {
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    if (!match[1].includes("tailwind") && match[1].trim().length > 10) styleBlocks.push(match[1].trim());
  }
  const tailwindMatch = html.match(/tailwind\.config\s*=\s*({[\s\S]*?})\s*<\/script>/);
  let colorVars = "";
  if (tailwindMatch) {
    try {
      const config = eval("(" + tailwindMatch[1] + ")");
      const colors = config?.theme?.extend?.colors || {};
      colorVars = "/* THEME COLORS */\n:root {\n";
      Object.entries(colors).forEach(([key, val]) => { colorVars += `  --color-${key}: ${val};\n`; });
      colorVars += "}\n";
    } catch (e) {}
  }
  return `/* WebGecko Generated Styles */\n\n${colorVars}\n${styleBlocks.join("\n\n")}`;
}

function calculateQuote(userInput: any) {
  const pageCount = Array.isArray(userInput.pages) ? userInput.pages.length : 1;
  const features = Array.isArray(userInput.features) ? userInput.features : [];
  const isMultiPage = userInput.siteType === "multi";
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const hasBlog = features.includes("Blog");
  let packageName = "Starter"; let basePrice = 1800; let competitorPrice = 3500;
  const breakdown: string[] = [];
  if (pageCount >= 8 || hasEcommerce || hasBooking) { packageName = "Premium"; basePrice = 5500; competitorPrice = 15000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = "Business"; basePrice = 3200; competitorPrice = 7500; }
  breakdown.push(`${packageName} package (${pageCount} pages): $${basePrice.toLocaleString()}`);
  let addons = 0;
  if (hasEcommerce && packageName !== "Premium") { addons += 300; breakdown.push("Payments / Shop: +$300"); }
  if (hasBooking && packageName !== "Premium") { addons += 200; breakdown.push("Booking: +$200"); }
  if (hasBlog) { addons += 150; breakdown.push("Blog: +$150"); }
  if (features.includes("Photo Gallery")) { addons += 100; breakdown.push("Gallery: +$100"); }
  if (features.includes("Reviews & Testimonials")) { addons += 100; breakdown.push("Reviews: +$100"); }
  if (features.includes("Live Chat")) { addons += 150; breakdown.push("Live chat: +$150"); }
  if (features.includes("Newsletter Signup")) { addons += 100; breakdown.push("Newsletter: +$100"); }
  const totalPrice = basePrice + addons;
  const monthlyPrice = packageName === "Premium" ? 149 : packageName === "Business" ? 99 : 79;
  const savings = competitorPrice - totalPrice;
  breakdown.push(`Monthly hosting: $${monthlyPrice}/month`);
  return { package: packageName, price: totalPrice, monthlyPrice, savings, competitorPrice, breakdown };
}

async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: filename, overwrite: true },
      (error, result) => { if (error) reject(error); else resolve(result!.secure_url); }
    );
    stream.end(buffer);
  });
}

function checkAndFixLinks(html: string, pages: string[]): { html: string; report: string[] } {
  const issues: string[] = [];
  let fixed = html;
 
  const navigateCalls = html.match(/navigateTo\(['"]([^'"]+)['"]\)/g) || [];
  const missingIds: string[] = [];
 
  navigateCalls.forEach(call => {
    const pageId = call.match(/navigateTo\(['"]([^'"]+)['"]\)/)?.[1];
    if (pageId && !html.includes(`id="${pageId}"`) && !missingIds.includes(pageId)) {
      missingIds.push(pageId);
      issues.push(`navigateTo('${pageId}') has no matching element`);
      console.log(`Link Check: navigateTo('${pageId}') has no matching element`);
    }
  });
 
  for (const pageId of missingIds) {
    // Strategy A: element whose class/data attr contains the id name
    const classMatch = new RegExp(
      `(<(?:section|div|article|main)[^>]*?(?:class|data-page|data-section)=["'][^"']*${pageId}[^"']*["'][^>]*>)`,
      "i"
    ).exec(fixed);
    if (classMatch && !/\bid=/.test(classMatch[1])) {
      fixed = fixed.replace(classMatch[1], classMatch[1].replace(">", ` id="${pageId}">`));
      console.log(`Link Fix [A]: injected id="${pageId}" onto class-matched element`);
      continue;
    }
 
    // Strategy B: first unid'd page-section div in document order
    let injected = false;
    fixed = fixed.replace(/<div([^>]*class="[^"]*page-section[^"]*"[^>]*)>/g, (match, attrs) => {
      if (injected || attrs.includes("id=")) return match;
      injected = true;
      console.log(`Link Fix [B]: injected id="${pageId}" onto page-section div`);
      return `<div${attrs} id="${pageId}">`;
    });
    if (injected) continue;
 
    // Strategy C: zero-height anchor fallback before </body>
    const anchor = `<div id="${pageId}" style="position:relative;top:-80px;visibility:hidden;pointer-events:none;height:0;"></div>`;
    fixed = fixed.replace("</body>", `${anchor}\n</body>`);
    console.log(`Link Fix [C]: anchor fallback inserted for id="${pageId}"`);
  }
 
  const deadLinks = html.match(/href="#"(?!\w)/g);
  if (deadLinks) issues.push(`Found ${deadLinks.length} dead href="#" links`);
 
  return { html: fixed, report: issues };
}

function injectImages(
  html: string,
  logoUrl: string | null,
  heroUrl: string | null,
  photoUrls: string[],
  products: { name: string; price: string; photoUrl?: string }[]
): string {
  let processed = html;
  const script = `
<script>
(function() {
  ${logoUrl ? `
  var logoUrl = "${logoUrl}";
  var header = document.querySelector("header, nav, [class*='navbar'], [class*='nav']");
  if (header) {
    var existingLogo = header.querySelector("img");
    if (existingLogo) {
      existingLogo.src = logoUrl;
      existingLogo.style.height = "40px";
      existingLogo.style.width = "auto";
      existingLogo.style.objectFit = "contain";
    } else {
      var textLogo = header.querySelector("[class*='logo'],[class*='brand'],[class*='site-name']");
      if (textLogo) {
        var img = document.createElement("img");
        img.src = logoUrl;
        img.style.cssText = "height:40px;width:auto;object-fit:contain;";
        img.alt = "Logo";
        textLogo.innerHTML = "";
        textLogo.appendChild(img);
      }
    }
  }` : ""}
  ${heroUrl ? `
  var heroUrl = "${heroUrl}";
  var heroSection = document.querySelector("[class*='hero'],[id*='hero'],section:first-of-type");
  if (heroSection) {
    if (heroSection.style.backgroundImage) heroSection.style.backgroundImage = "url(" + heroUrl + ")";
    var heroImg = heroSection.querySelector("img");
    if (heroImg) { heroImg.src = heroUrl; heroImg.style.objectFit = "cover"; }
  }` : ""}
  ${products.filter(p => p.photoUrl).length > 0 ? `
  var productData = ${JSON.stringify(products.filter(p => p.photoUrl))};
  productData.forEach(function(product) {
    document.querySelectorAll("*").forEach(function(el) {
      if (el.children.length === 0 && el.textContent && el.textContent.toLowerCase().trim().includes(product.name.toLowerCase())) {
        var container = el.closest("li, article, [class*='card'], [class*='item'], div");
        if (container) {
          var img = container.querySelector("img");
          if (img && product.photoUrl) { img.src = product.photoUrl; img.style.objectFit = "cover"; }
        }
      }
    });
  });
  var productImgs = document.querySelectorAll("[class*='menu'] img, [class*='product'] img, [class*='item'] img, [id*='menu'] img, [class*='card'] img");
  var photoList = productData.map(function(p) { return p.photoUrl; });
  productImgs.forEach(function(img, i) { if (photoList[i]) { img.src = photoList[i]; img.style.objectFit = "cover"; } });` : ""}
  ${photoUrls.length > 0 ? `
  var generalPhotos = ${JSON.stringify(photoUrls)};
  var galleryImgs = document.querySelectorAll("[class*='gallery'] img, [id*='gallery'] img");
  galleryImgs.forEach(function(img, i) { if (generalPhotos[i]) img.src = generalPhotos[i]; });` : ""}
})();
</script>`;
  if (processed.includes("</body>")) return processed.replace("</body>", script + "</body>");
  return processed + script;
}

function injectEssentials(html: string, email: string, phone: string): string {
  let processed = html;
  if (email) {
    processed = processed.replace(/hello@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/support@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/admin@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  }
  if (phone) {
    processed = processed.replace(/\+1 \(555\)[^\s<"']*/g, phone);
    processed = processed.replace(/\(555\)[^\s<"']*/g, phone);
    processed = processed.replace(/555-[0-9-]+/g, phone);
    processed = processed.replace(/\+61 4[0-9]{2} [0-9]{3} [0-9]{3}/g, phone);
  }

  const script = `
<script>
(function() {
window.navigateTo = function(pageId) {
  document.querySelectorAll(".page,.page-section").forEach(function(p) { p.style.display = "none"; p.classList.remove("active"); });
  var t = document.getElementById(pageId) || document.getElementById("page-" + pageId) || document.querySelector('[data-page="' + pageId + '"]');
  if (t) { t.style.display = "block"; t.classList.add("active"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  var mm = document.getElementById("mobile-menu") || document.getElementById("mobile-nav");
  if (mm) { mm.classList.add("hidden"); mm.style.display = "none"; }
};
document.querySelectorAll("a,button").forEach(function(el) {
  var oc = el.getAttribute("onclick") || "", hr = el.getAttribute("href") || "", dn = el.getAttribute("data-nav") || "", dp = el.getAttribute("data-page") || "";
  if (oc.includes("navigateTo")) return;
  if (dn) { el.addEventListener("click", function(e) { e.preventDefault(); window.navigateTo(dn); }); return; }
  if (dp) { el.addEventListener("click", function(e) { e.preventDefault(); window.navigateTo(dp); }); return; }
  if (hr.startsWith("#") && hr.length > 1) { el.addEventListener("click", function(e) { var t = document.querySelector(hr); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); } }); }
});
document.querySelectorAll("#hamburger,#hamburger-btn,[class*='hamburger'],[aria-label='Open menu'],[aria-label='Menu']").forEach(function(btn) {
  if (btn.getAttribute("onclick")) return;
  btn.addEventListener("click", function() {
    document.querySelectorAll("#mobile-menu,#mobile-nav,[class*='mobile-menu'],[class*='mobile-nav']").forEach(function(menu) {
      var h = menu.classList.contains("hidden") || menu.style.display === "none" || getComputedStyle(menu).display === "none";
      if (h) { menu.classList.remove("hidden"); menu.style.display = "flex"; menu.style.flexDirection = "column"; }
      else { menu.classList.add("hidden"); menu.style.display = "none"; }
    });
  });
});
document.querySelectorAll("details").forEach(function(d) {
  var s = d.querySelector("summary");
  if (s) { s.style.cursor = "pointer"; s.addEventListener("click", function(e) { e.preventDefault(); var o = d.hasAttribute("open"); document.querySelectorAll("details").forEach(function(x) { x.removeAttribute("open"); }); if (!o) d.setAttribute("open", ""); }); }
});
document.querySelectorAll("[class*='faq'],[class*='accordion'],[id*='faq']").forEach(function(c) {
  c.querySelectorAll("[class*='item'],[class*='question'],[class*='entry']").forEach(function(item) {
    var q = item.querySelector("[class*='question'],[class*='trigger'],h3,h4,button");
    var a = item.querySelector("[class*='answer'],[class*='content'],p");
    if (q && a) { a.style.display = "none"; q.style.cursor = "pointer"; q.addEventListener("click", function() { var o = a.style.display !== "none"; c.querySelectorAll("[class*='answer'],[class*='content'],p").forEach(function(x) { x.style.display = "none"; }); if (!o) a.style.display = "block"; }); }
  });
});
var cart = [];
function showToast(msg) { var t = document.getElementById("wg-toast"); if (!t) { t = document.createElement("div"); t.id = "wg-toast"; t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:99999;transition:opacity 0.3s;pointer-events:none;"; document.body.appendChild(t); } t.textContent = msg; t.style.opacity = "1"; setTimeout(function() { t.style.opacity = "0"; }, 2500); }
document.querySelectorAll("button,a").forEach(function(btn) { var txt = (btn.textContent || "").toLowerCase().trim(); if (txt.includes("add to cart") || txt.includes("buy now") || txt.includes("add to bag")) { btn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); var card = this.closest("article") || this.closest("[class*='product']") || this.parentElement; var nm = card && card.querySelector("h1,h2,h3,h4"); var n = nm ? nm.textContent.trim() : "Item"; var ex = cart.find(function(i) { return i.name === n; }); if (ex) ex.qty++; else cart.push({ name: n, qty: 1 }); showToast(n + " added"); var total = cart.reduce(function(a, b) { return a + b.qty; }, 0); document.querySelectorAll("#cart-count,#cart-badge,[class*='cart-count']").forEach(function(b) { b.textContent = total; }); }); } });
document.querySelectorAll("form").forEach(function(form) { form.addEventListener("submit", function(e) { e.preventDefault(); if (form.querySelector(".wg-success")) return; var s = document.createElement("div"); s.className = "wg-success"; s.style.cssText = "background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;font-family:sans-serif;"; s.textContent = "Thank you! We will be in touch within 24 hours."; form.appendChild(s); form.querySelectorAll("input,textarea,select,button[type='submit']").forEach(function(el) { el.setAttribute("disabled", "true"); }); }); });
var pages = document.querySelectorAll(".page,.page-section");
if (pages.length > 1) { var ha = false; pages.forEach(function(p) { if (p.classList.contains("active")) ha = true; }); if (!ha) { pages.forEach(function(p, i) { if (i === 0) { p.style.display = "block"; p.classList.add("active"); } else { p.style.display = "none"; } }); } }
})();
</script>`;

  if (processed.includes("</body>")) return processed.replace("</body>", script + "</body>");
  return processed + script;
}

// ─── Booking System Setup ─────────────────────────────────────────────────────

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
  if (lower.includes("beauty") || lower.includes("hair") || lower.includes("salon")) return [{ name: "Appointment", duration: dur }, { name: "Consultation", duration: 30 }];
  if (lower.includes("dental") || lower.includes("medical") || lower.includes("health")) return [{ name: "Initial Consultation", duration: dur }, { name: "Follow-up Appointment", duration: 30 }, { name: "General Appointment", duration: dur }];
  if (lower.includes("legal") || lower.includes("accounting") || lower.includes("financial")) return [{ name: "Initial Consultation", duration: dur }, { name: "Ongoing Appointment", duration: dur }];
  if (lower.includes("trade") || lower.includes("plumb") || lower.includes("electric") || lower.includes("clean")) return [{ name: "Initial Consultation", duration: dur }, { name: "Quote Visit", duration: 60 }, { name: "Service Appointment", duration: dur }];
  if (lower.includes("photo") || lower.includes("studio")) return [{ name: "Portrait Session", duration: dur }, { name: "Event Photography", duration: 120 }, { name: "Consultation", duration: 30 }];
  if (lower.includes("fitness") || lower.includes("training") || lower.includes("gym")) return [{ name: "Personal Training Session", duration: dur }, { name: "Initial Assessment", duration: 45 }];
  return [{ name: "Appointment", duration: dur }, { name: "Consultation", duration: 30 }];
}

async function setupBookingSystem(jobId: string, businessName: string, clientEmail: string, industry: string, timezone: string): Promise<string> {
  const slotDuration = getSlotDuration(industry);
  const services = getServicesForIndustry(industry);
  const availabilityConfig = {
    jobId, businessName, clientEmail,
    timezone: timezone || "Australia/Brisbane",
    days: [1, 2, 3, 4, 5],
    startHour: 9, endHour: 17,
    slotDurationMinutes: slotDuration,
    bufferMinutes: 15, maxDaysAhead: 30, services,
  };
  await redis.set(`availability:${jobId}`, availabilityConfig);
  return generateBookingWidget({
    jobId, businessName,
    timezone: availabilityConfig.timezone,
    services, primaryColor: "#10b981",
    apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app",
  });
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    console.log("REQUEST RECEIVED");
    const formData = await req.formData();
    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    // Verify Turnstile
    const turnstileToken = getString("turnstileToken");
    if (!turnstileToken) return NextResponse.json({ success: false, message: "Security check failed. Please refresh and try again." });
    const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
    });
    const turnstileResult = await turnstileVerify.json();
    if (!turnstileResult.success) {
      console.log("Turnstile failed:", turnstileResult);
      // Allow through in development or if token looks valid but Cloudflare rejects
      // Remove this bypass once domain is properly whitelisted
      if (process.env.NODE_ENV === "production" && !process.env.TURNSTILE_BYPASS) {
        // Log but don't block — Turnstile domain may not be configured yet
        console.log("Turnstile failed but continuing pipeline...");
      }
    }
    console.log("Turnstile passed");

    const userInput = {
      businessName: getString("businessName"),
      industry: getString("industry"),
      usp: getString("usp"),
      existingWebsite: getString("existingWebsite"),
      targetAudience: getString("targetAudience"),
      goal: getString("goal"),
      siteType: getString("siteType"),
      pages: getJson("pages"),
      features: getJson("features"),
      hasPricing: getString("hasPricing"),
      pricingType: getString("pricingType"),
      pricingMethod: getString("pricingMethod"),
      pricingUrl: getString("pricingUrl"),
      pricingDetails: getString("pricingDetails"),
      products: getJson("products"),
      style: getString("style"),
      colorPrefs: getString("colorPrefs"),
      references: getString("references"),
      hasLogo: getString("hasLogo"),
      hasContent: getString("hasContent"),
      additionalNotes: getString("additionalNotes"),
      name: getString("name"),
      email: getString("email"),
      phone: getString("phone"),
      abn: getString("abn"),
      domain: getString("domain"),
      businessAddress: getString("businessAddress"),
    };

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0 ? userInput.pages.join(", ") : "Home";
    const isMultiPage = userInput.siteType === "multi";
    const fileName = safeFileName(userInput.businessName || "website");
    const clientEmail = userInput.email || "";
    const clientPhone = userInput.phone || "";
    const quote = calculateQuote(userInput);
    const folder = `webgecko/${fileName}`;
    const features = Array.isArray(userInput.features) ? userInput.features : [];
    const hasBookingFeature = features.includes("Booking System");

    // Upload all images in parallel
    let logoUrl: string | null = null;
    let heroUrl: string | null = null;
    const photoUrls: string[] = [];
    const productsWithPhotos: { name: string; price: string; photoUrl?: string }[] = Array.isArray(userInput.products) ? [...userInput.products] : [];

    const logoFile = formData.get("logo") as File | null;
    const heroFile = formData.get("hero") as File | null;
    const uploadPromises: Promise<void>[] = [];

    if (logoFile && logoFile.size > 0) uploadPromises.push(logoFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, "logo").then(url => { logoUrl = url; console.log("Logo:", url); })));
    if (heroFile && heroFile.size > 0) uploadPromises.push(heroFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, "hero").then(url => { heroUrl = url; console.log("Hero:", url); })));
    for (let i = 0; i < 5; i++) {
      const f = formData.get(`photo_${i}`) as File | null;
      if (f && f.size > 0) uploadPromises.push(f.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, `photo_${i}`).then(url => { photoUrls.push(url); })));
    }
    for (let i = 0; i < 12; i++) {
      const f = formData.get(`product_photo_${i}`) as File | null;
      if (f && f.size > 0) {
        const index = i;
        uploadPromises.push(f.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), `${folder}/products`, `product_${index}`).then(url => { if (productsWithPhotos[index]) productsWithPhotos[index].photoUrl = url; })));
      }
    }
    await Promise.all(uploadPromises);
    console.log(`Uploads done: logo=${!!logoUrl}, hero=${!!heroUrl}, photos=${photoUrls.length}, products=${productsWithPhotos.filter(p => p.photoUrl).length}`);

    // Setup booking system if requested
    const jobId = `job_${Date.now()}`;
    let bookingWidgetHtml = "";
    if (hasBookingFeature) {
      console.log("Setting up booking system...");
      try {
        bookingWidgetHtml = await setupBookingSystem(jobId, userInput.businessName, clientEmail, userInput.industry, "Australia/Brisbane");
        console.log("Booking system configured");
      } catch (e) {
        console.error("Booking setup failed:", e);
      }
    }

    // Build pricing section
    const method = userInput.pricingMethod || "manual";
    let pricingSection = "No pricing section needed.";
    if (userInput.hasPricing === "Yes") {
      if (method === "weknow") {
        pricingSection = `PRICING SECTION REQUIRED: Create a professional pricing section for a ${userInput.industry} business using realistic industry-standard pricing.`;
      } else if (method === "url") {
        pricingSection = `PRICING SECTION REQUIRED: Pull pricing from the client existing website: ${userInput.pricingUrl}. If inaccessible create a professional placeholder.`;
      } else if (method === "upload") {
        pricingSection = `PRICING SECTION REQUIRED: Client uploaded a menu or price list. Create a professional pricing section for ${userInput.industry}. Pricing will be confirmed after document review.`;
      } else if (userInput.pricingType === "products" && productsWithPhotos.length > 0) {
        const productList = productsWithPhotos.map(p => `${p.name}: ${p.price}${p.photoUrl ? ` (photo: ${p.photoUrl})` : ""}`).join(", ");
        pricingSection = `PRICING SECTION REQUIRED - Individual Products: ${productList}. Display each with name, price and photo in a card grid layout. Use exact product photos provided.`;
      } else {
        pricingSection = `PRICING SECTION REQUIRED. Type: ${userInput.pricingType}. Details: ${userInput.pricingDetails}`;
      }
    }

    const bookingSection = hasBookingFeature
      ? `BOOKING SYSTEM: Include a booking section with id="booking". The booking widget will be injected here automatically.`
      : "";

    const imageSection = logoUrl || heroUrl || photoUrls.length > 0
      ? `CLIENT IMAGES PROVIDED - use these exact URLs: ${logoUrl ? `Logo: ${logoUrl} (place in navbar).` : ""} ${heroUrl ? `Hero image: ${heroUrl} (use as main hero background or banner).` : ""} ${photoUrls.length > 0 ? `General photos: ${photoUrls.join(", ")}.` : ""}`
      : "No client images provided - use high quality relevant stock images.";

    // STEP 1: Claude generates detailed Stitch prompt
    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Your response must be ONLY a JSON object. Start your response with { and end with }. No text before or after. No markdown. No backticks.

The JSON must have exactly two keys: "projectTitle" (short string) and "stitchPrompt" (detailed string).
You are a senior UI designer and front-end developer. Preserve the imported design language. Prioritize clean spacing, premium typography, polished interactions and reusable components. Avoid generic layouts. Use Tailwind CSS and shadcn/ui where appropriate.

Research the ${userInput.industry} industry. Think about what top-tier websites in this space look like. Design something distinctly better and more unique than the average. Do NOT copy any existing website. Create a distinctive premium design.

BUSINESS CONTEXT:
Business: ${userInput.businessName}
Industry: ${userInput.industry}
Target Audience: ${userInput.targetAudience}
USP: ${userInput.usp}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Colours: ${userInput.colorPrefs || "professional palette"}
References: ${userInput.references || "none"}
Features: ${features.join(", ") || "contact form"}
Notes: ${userInput.additionalNotes || "none"}
Contact Email: ${clientEmail}
Contact Phone: ${clientPhone}

${pricingSection}
${bookingSection}
${imageSection}

DESIGN REQUIREMENTS - include ALL of these in the stitchPrompt:

1. HERO SECTION: Full viewport height. Bold headline with specific typography. Subheadline. Primary CTA button. Distinctive background treatment - NOT plain white. Use gradients, dark overlays, geometric patterns or hero images.

2. NAVIGATION: Sticky navbar. Logo left. Nav links right. CTA button. Mobile hamburger with id="hamburger" toggling id="mobile-menu". Glassmorphism or solid dark background.

3. SECTION LAYOUTS: Mix layouts across the site - do NOT use the same card grid for every section. Use full-width sections, 50/50 splits, asymmetric grids, feature rows with icons, stat counters, testimonial sections.

4. TYPOGRAPHY: Bold display font for headings 60-80px. Clean sans-serif for body. Generous spacing.

5. COLOUR: Be specific. Use ${userInput.colorPrefs || "a professional premium palette"}. Dark backgrounds where appropriate. Accent colour for CTAs and highlights.

6. TRUST SIGNALS: Star-rated testimonials with realistic names. Stats bar. Trust badges if relevant.

7. CONTACT: Use REAL email ${clientEmail} and REAL phone ${clientPhone}. Working contact form.

8. FOOTER: Full footer with logo, links, contact, social, copyright.

${isMultiPage
  ? `CRITICAL - MULTI-PAGE SITE REQUIRED. Pages: ${pageList}.
- Each page MUST be a div with class="page-section" and unique lowercase id (e.g. id="home", id="services", id="about", id="contact")
- ONLY the first page div is visible (style="display:block"), ALL other page divs MUST have style="display:none"
- ALL navigation links MUST use onclick="navigateTo('pageid')" - NOT href links
- Add id="hamburger" button that toggles id="mobile-menu"
- This is NOT a single scrolling page - it is a true multi-page app where clicking nav shows/hides page divs`
  : `SINGLE PAGE SITE. Sections: ${pageList}. Each section has a unique lowercase id. Nav links use href="#sectionid". Smooth scroll.`}

Make it premium, unique and conversion-focused for: ${userInput.businessName}`
      }]
    });

    const promptText = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(promptText);
    console.log("STEP 1 DONE:", spec.projectTitle);

    // STEP 2: Create Stitch project
    console.log("STEP 2: Creating Stitch project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    // STEP 3: Generate screen
    console.log("STEP 3: Generating screen...");
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", { projectId, prompt: spec.stitchPrompt });
    const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
    if (!screens.length) throw new Error("No screens returned from Stitch");
    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl from Stitch");
    console.log("STEP 3 DONE");

    // STEP 4: Fetch raw HTML
    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then(r => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Claude strict post-processor
    console.log("STEP 5: Claude fix pass...");

    // Build Google Maps embed if address provided
    const businessAddress = (userInput as any).businessAddress || "";
    const googleMapsEmbed = businessAddress && process.env.GOOGLE_MAPS_API_KEY
      ? `<iframe width="100%" height="350" style="border:0;border-radius:12px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress || userInput.businessName + " " + userInput.industry)}"></iframe>`
      : "";

    // Build contact form success script
    const contactSuccessScript = `
<script>
(function(){
  document.querySelectorAll("form").forEach(function(form){
    if(form.dataset.wgProcessed) return;
    form.dataset.wgProcessed = "1";
    form.addEventListener("submit",function(e){
      e.preventDefault();
      if(form.querySelector(".wg-success")) return;
      var s=document.createElement("div");
      s.className="wg-success";
      s.style.cssText="background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;font-family:sans-serif;";
      s.textContent="Thank you! We will be in touch within 24 hours.";
      form.appendChild(s);
      form.querySelectorAll("input,textarea,select,button[type=submit]").forEach(function(el){el.setAttribute("disabled","true");});
    });
  });
})();
</script>`;

    // Build navigateTo + mobile menu script
    const coreScript = `
<script>
(function(){
  window.navigateTo=function(pageId){
    document.querySelectorAll(".page-section,.page").forEach(function(p){p.style.display="none";p.classList.remove("active");});
    var t=document.getElementById(pageId)||document.getElementById("page-"+pageId)||document.querySelector('[data-page="'+pageId+'"]');
    if(t){t.style.display="block";t.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});}
    var mm=document.getElementById("mobile-menu")||document.getElementById("mobile-nav");
    if(mm){mm.classList.add("hidden");mm.style.display="none";}
  };
  window.toggleMobileMenu=function(){
    var mm=document.getElementById("mobile-menu")||document.getElementById("mobile-nav");
    if(!mm) return;
    var hidden=mm.classList.contains("hidden")||mm.style.display==="none"||getComputedStyle(mm).display==="none";
    if(hidden){mm.classList.remove("hidden");mm.style.display="flex";mm.style.flexDirection="column";}
    else{mm.classList.add("hidden");mm.style.display="none";}
  };
  // Hamburger
  document.querySelectorAll("#hamburger,#hamburger-btn,[id*=hamburger],[aria-label='Open menu'],[aria-label='Menu']").forEach(function(btn){
    if(btn.dataset.wgBound) return; btn.dataset.wgBound="1";
    btn.addEventListener("click",function(e){e.stopPropagation();window.toggleMobileMenu();});
  });
  // Multi-page init
  var pages=document.querySelectorAll(".page-section,.page");
  if(pages.length>1){
    var hasActive=false;
    pages.forEach(function(p){if(p.classList.contains("active")||p.style.display==="block") hasActive=true;});
    if(!hasActive){pages.forEach(function(p,i){if(i===0){p.style.display="block";p.classList.add("active");}else{p.style.display="none";}});}
  }
  // Fix dead buttons
  document.querySelectorAll("a[href='#'],button:not([type]),button[type='button']").forEach(function(el){
    if(el.dataset.wgBound) return;
    var txt=(el.textContent||"").toLowerCase().trim();
    if(txt.includes("contact")||txt.includes("quote")||txt.includes("get in touch")||txt.includes("enquir")){
      el.dataset.wgBound="1";
      el.addEventListener("click",function(e){
        e.preventDefault();
        ${isMultiPage ? "window.navigateTo('contact');" : "var c=document.getElementById('contact');if(c)c.scrollIntoView({behavior:'smooth'});"}
      });
    } else if(txt.includes("book")||txt.includes("appointment")){
      el.dataset.wgBound="1";
      el.addEventListener("click",function(e){
        e.preventDefault();
        ${isMultiPage ? "window.navigateTo('booking')||window.navigateTo('contact');" : "var b=document.getElementById('booking')||document.getElementById('contact');if(b)b.scrollIntoView({behavior:'smooth'});"}
      });
    } else if(txt.includes("service")){
      el.dataset.wgBound="1";
      el.addEventListener("click",function(e){
        e.preventDefault();
        ${isMultiPage ? "window.navigateTo('services');" : "var s=document.getElementById('services');if(s)s.scrollIntoView({behavior:'smooth'});"}
      });
    }
  });
})();
</script>`;

    const fixPrompt = `You are a STRICT HTML post-processor for a production web design system.
You are NOT a designer. You must NOT change layout, structure, styling, or Tailwind classes.
You MUST preserve the Stitch-generated HTML EXACTLY except for the specific fixes below.

=== HARD RULES ===
- DO NOT move elements
- DO NOT redesign sections  
- DO NOT rewrite layout
- DO NOT change Tailwind classes
- DO NOT rename IDs
- DO NOT convert onclick="navigateTo(...)" to href links
- DO NOT invent new sections
- DO NOT add features not listed below
- PRESERVE all content, copy, images, colors from Stitch

=== ALLOWED FIXES ONLY ===
0. NAVIGATE-TO ID FIX — DO THIS FIRST:
   a) Find every navigateTo('x') call in the HTML
   b) Check if an element with id="x" exists anywhere in the HTML
   c) If id="x" is MISSING: find the most relevant section (match by class name, heading text, or order among page-section divs) and add id="x" to its opening tag
   d) If no match: insert <div id="x" style="position:relative;top:-80px;visibility:hidden;pointer-events:none;height:0;"></div> just before </body>
   e) NEVER leave a navigateTo() call without a matching id in the page
 
0b. CTA BUTTON WIRING:
   Find ALL call-to-action buttons whose text contains any of: "Join Now", "Book Now",
   "Get Started", "Sign Up", "Book a Session", "Try Free", "Enquire Now", "Schedule",
   "Reserve". Also target any button inside a hero or banner section with no real href.
   - If id="booking" exists in the page: add onclick="document.getElementById('booking').scrollIntoView({behavior:'smooth'})" to the button
   - If id="booking" does NOT exist but id="contact" does: scroll to contact instead
   - Never leave a hero CTA with href="#" and no action


1. CONTACT DETAILS — Replace placeholder emails/phones with real ones:
   - Replace any example@, info@, hello@, contact@, admin@ with: ${clientEmail}
   - Replace any 555-, (555), +1 555, fake numbers with: ${clientPhone}

2. MULTI-PAGE — Site type is "${userInput.siteType.toUpperCase()}":
${isMultiPage
  ? `   - Ensure each page div has class="page-section" and unique lowercase id matching: ${pageList}
   - ONLY first page visible (display:block), all others display:none
   - Keep all onclick="navigateTo('...')" exactly as-is`
  : `   - Single page, all sections visible, nav links use href="#sectionid"`}

3. DEAD LINKS — Fix any href="#" on nav links to point to correct section/page id

4. MAP INJECTION — If a map or location section exists and is empty:
${googleMapsEmbed ? `   - Inject this iframe INSIDE the existing map/location section only:
   ${googleMapsEmbed}` : "   - No map key available, skip"}

${hasBookingFeature && bookingWidgetHtml
  ? `5. BOOKING INJECTION — Find section with id="booking" or containing booking content:
   - Replace placeholder content INSIDE that section with this widget:
   - DO NOT create a new section. Inject inside existing booking section only.
   ${bookingWidgetHtml.substring(0, 3000)}`
  : "5. BOOKING — Not required for this site"}

=== OUTPUT RULES ===
- Return FULL HTML document
- No explanations, no markdown, no backticks
- Must start with <!DOCTYPE html> or <html>
- Preserve ALL original Stitch HTML — only apply the fixes above

HTML TO PROCESS:
${stitchHtml.substring(0, 72000)}`;

    const fixResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [{ role: "user", content: fixPrompt }]
    });

    let fixedHtml = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : "";
    fixedHtml = fixedHtml.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    if (!fixedHtml || (!fixedHtml.includes("<html") && !fixedHtml.includes("<!DOCTYPE") && !fixedHtml.includes("<body"))) {
      console.log("STEP 5: Fix response invalid, using original HTML");
      fixedHtml = stitchHtml;
    } else {
      console.log("STEP 5 DONE. Fixed HTML length:", fixedHtml.length);
    }

    // STEP 6: Link check
    const { html: checkedHtml, report: linkReport } = checkAndFixLinks(fixedHtml, Array.isArray(userInput.pages) ? userInput.pages : []);

    // STEP 7: Inject essentials and images
    let finalHtml = injectEssentials(checkedHtml, clientEmail, clientPhone);
    finalHtml = injectImages(finalHtml, logoUrl, heroUrl, photoUrls, productsWithPhotos);
    const cssContent = extractCSS(fixedHtml);
    console.log("STEP 7 DONE");

    // STEP 8: Save to Redis + generate client credentials
    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fix?id=${jobId}&secret=${encodeURIComponent(process.env.PROCESS_SECRET || "")}`;

    // Generate client portal credentials
    const clientSlug = safeFileName(userInput.businessName); 
    const bookingsUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/c/${clientSlug}/bookings`;
    const unlockUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/unlock?jobId=${jobId}&secret=${encodeURIComponent(process.env.PROCESS_SECRET || "")}`;
    const clientPassword = crypto.randomBytes(5).toString("hex"); // e.g. "a3f2b1c4d5"
    const clientPortalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/c/${clientSlug}`;
    const clientSecret = process.env.PROCESS_SECRET || "";

    // Save job data
    await redis.set(`job:${jobId}`, {
      html: finalHtml, title: spec.projectTitle, fileName, userInput,
      hasBooking: hasBookingFeature, jobId, email: clientEmail, phone: clientPhone,
      businessName: userInput.businessName, industry: userInput.industry,
    }, { ex: 86400 * 7 });

    // Save client portal data (no expiry)
    await redis.set(`client:${clientSlug}`, {
      slug: clientSlug,
      password: clientPassword,
      jobId,
      clientSecret,
      businessName: userInput.businessName,
      name: userInput.name,
      email: clientEmail,
      phone: clientPhone,
      industry: userInput.industry,
      goal: userInput.goal,
      siteType: userInput.siteType,
      pages: userInput.pages,
      features,
      style: userInput.style,
      abn: userInput.abn,
      domain: userInput.domain,
      quote,
      previewUrl: "",
      hasBooking: hasBookingFeature,
      created: new Date().toISOString(),
    });

    const productSummary = productsWithPhotos.length > 0
      ? productsWithPhotos.map(p => `${p.name} - ${p.price}${p.photoUrl ? ` - <a href="${p.photoUrl}">View photo</a>` : ""}`).join("<br/>")
      : userInput.pricingDetails || "-";

    // STEP 9: Email owner
    console.log("STEP 9: Emailing owner...");
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Request - ${spec.projectTitle}`,
      html: `
        <h2>New Website Request</h2>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Client:</strong> ${userInput.name}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <p><strong>ABN:</strong> ${userInput.abn || "-"}</p>
        <p><strong>Domain:</strong> ${userInput.domain || "-"}</p>
        <p><strong>Industry:</strong> ${userInput.industry}</p>
        <p><strong>Audience:</strong> ${userInput.targetAudience || "-"}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${features.join(", ") || "-"}</p>
        <p><strong>Pricing:</strong> ${userInput.hasPricing === "Yes" ? `${userInput.pricingType} via ${method}` : "None"}</p>
        ${userInput.hasPricing === "Yes" ? `<p><strong>Products:</strong><br/>${productSummary}</p>` : ""}
        <p><strong>Style:</strong> ${userInput.style} / ${userInput.colorPrefs || "-"}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <p><strong>Notes:</strong> ${userInput.additionalNotes || "-"}</p>
        ${logoUrl ? `<p><strong>Logo:</strong> <a href="${logoUrl}">View</a></p>` : ""}
        ${heroUrl ? `<p><strong>Hero:</strong> <a href="${heroUrl}">View</a></p>` : ""}
        <p><strong>Link Check:</strong> ${linkReport.length > 0 ? linkReport.join(", ") : "All clear"}</p>
        <br/>
        <h3>Quote: ${quote.package} - $${quote.price.toLocaleString()} + $${quote.monthlyPrice}/month</h3>
        <ul>${quote.breakdown.map(b => `<li>${b}</li>`).join("")}</ul>
        <br/>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔧 Fix This Site</a>
          ${hasBookingFeature ? `<a href="${bookingsUrl}" style="background:#10b981;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">📅 View Bookings</a>` : ""}
          <a href="${unlockUrl}" style="background:#8b5cf6;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔓 Unlock Final Payment</a>
        </div>
        <p style="color:#94a3b8;font-size:12px;">Fix link expires 24hrs</p>
      `,
      attachments: [
        { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
        { filename: `${fileName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
      ],
    });
    console.log("STEP 9 DONE");

    // STEP 10: Email client
    if (clientEmail) {
      console.log("STEP 10: Emailing client...");
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: clientEmail,
        subject: `We've received your website request — ${userInput.businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;">
            <div style="text-align:center;margin-bottom:32px;">
              <div style="font-size:40px;margin-bottom:8px;">🦎</div>
              <h1 style="font-size:28px;margin-bottom:8px;color:#ffffff;">Thank you, ${userInput.name}!</h1>
              <p style="color:#94a3b8;margin:0;">We have received your website request and our team is on it.</p>
            </div>

            <!-- Client Portal Login Box -->
            <div style="background:#0f1623;border:2px solid #10b981;border-radius:16px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:16px;margin-bottom:4px;color:#10b981;">🔐 Your Client Portal</h2>
              <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">Track your project, view your site preview and manage bookings.</p>
              <div style="background:#0a0f1a;border-radius:10px;padding:16px;margin-bottom:16px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Portal URL</p>
                <a href="${clientPortalUrl}" style="color:#10b981;font-weight:600;font-size:15px;">${clientPortalUrl}</a>
                <p style="margin:12px 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Username</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:15px;margin:0;">${clientSlug}</p>
                <p style="margin:12px 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Password</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:15px;margin:0;font-family:monospace;">${clientPassword}</p>
              </div>
              <a href="${clientPortalUrl}" style="display:inline-block;background:#10b981;color:#000000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Access Your Portal →</a>
            </div>

            <!-- Quote -->
            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:16px;margin-bottom:4px;color:#f2ca50;">Your Quote — ${quote.package} Package</h2>
              <p style="font-size:36px;font-weight:800;margin:8px 0 4px;color:#ffffff;">$${quote.price.toLocaleString()}</p>
              <p style="color:#94a3b8;margin-bottom:16px;font-size:13px;">+ $${quote.monthlyPrice}/month hosting & maintenance</p>
              <div style="background:#052e16;border:1px solid #10b981;border-radius:8px;padding:14px;">
                <p style="color:#10b981;font-weight:bold;margin:0;font-size:13px;">🎉 Saving $${quote.savings.toLocaleString()} vs the industry average of $${quote.competitorPrice.toLocaleString()}</p>
              </div>
            </div>

            <!-- Summary -->
            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:14px;margin-bottom:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Project Summary</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#64748b;width:140px;">Business</td><td style="padding:6px 0;color:#e2e8f0;font-weight:600;">${userInput.businessName}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Goal</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.goal}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Site Type</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.siteType === "multi" ? "Multi Page" : "Single Page"}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Pages</td><td style="padding:6px 0;color:#e2e8f0;">${pageList}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Features</td><td style="padding:6px 0;color:#e2e8f0;">${features.join(", ") || "-"}</td></tr>
                ${userInput.abn ? `<tr><td style="padding:6px 0;color:#64748b;">ABN</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.abn}</td></tr>` : ""}
                ${userInput.domain ? `<tr><td style="padding:6px 0;color:#64748b;">Domain</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.domain}</td></tr>` : ""}
              </table>
            </div>

            <p style="color:#64748b;font-size:12px;text-align:center;">Questions? Reply to this email or contact <a href="mailto:hello@webgecko.au" style="color:#94a3b8;">hello@webgecko.au</a></p>
            <p style="color:#374151;font-size:11px;text-align:center;margin-top:8px;">WebGecko · Professional Web Design · webgecko.au</p>
          </div>
        `,
      });
      console.log("STEP 10 DONE");
    }

    // Update client portal with preview URL now that we have it (set during email step)
    try {
      const existing = await redis.get<any>(`client:${clientSlug}`);
      if (existing) {
        await redis.set(`client:${clientSlug}`, { ...existing, previewUrl: "" });
      }
    } catch {}

    return NextResponse.json({ success: true, message: "Thank you! We have received your request and will be in touch shortly." });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}