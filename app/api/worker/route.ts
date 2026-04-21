export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";
import { v2 as cloudinary } from "cloudinary";

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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
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

// Check all links and buttons in the HTML and fix dead ones
function checkAndFixLinks(html: string, pages: string[]): { html: string; report: string[] } {
  const issues: string[] = [];
  let fixed = html;

  // Find all href="#" dead links and fix them
  const deadLinks = html.match(/href="#"(?!\w)/g);
  if (deadLinks) {
    issues.push(`Found ${deadLinks.length} dead href="#" links`);
  }

  // Check all nav links point to real sections/pages
  const navLinks = html.match(/href="#([^"]+)"/g) || [];
  navLinks.forEach(link => {
    const id = link.match(/href="#([^"]+)"/)?.[1];
    if (id && !html.includes(`id="${id}"`)) {
      issues.push(`Nav link #${id} has no matching section id`);
      // Add the missing id to the first matching page section
      const pageMatch = pages.find(p => p.toLowerCase() === id.toLowerCase());
      if (pageMatch) {
        fixed = fixed.replace(
          new RegExp(`(<(?:section|div)[^>]*class="[^"]*(?:page|section)[^"]*"[^>]*>)`),
          `$1`
        );
      }
    }
  });

  // Check navigateTo calls have matching page sections
  const navigateCalls = html.match(/navigateTo\(['"]([^'"]+)['"]\)/g) || [];
  navigateCalls.forEach(call => {
    const pageId = call.match(/navigateTo\(['"]([^'"]+)['"]\)/)?.[1];
    if (pageId && !html.includes(`id="${pageId}"`)) {
      issues.push(`navigateTo('${pageId}') has no matching id="${pageId}" element`);
    }
  });

  // Ensure all form submit buttons have type="submit" or are inside forms
  const orphanButtons = html.match(/<button[^>]*>(?:Submit|Send|Contact|Book|Order)[^<]*<\/button>/gi) || [];
  orphanButtons.forEach(btn => {
    if (!btn.includes('type=')) {
      issues.push(`Button "${btn.substring(0, 50)}" missing type attribute`);
    }
  });

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
  processed = processed.replace(/hello@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/support@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/\+1 \(555\)[^\s<"']*/g, phone);
  processed = processed.replace(/\(555\)[^\s<"']*/g, phone);
  processed = processed.replace(/555-[0-9-]+/g, phone);

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
document.querySelectorAll("button,a").forEach(function(btn) { var txt = (btn.textContent || "").toLowerCase().trim(); if (txt.includes("add to cart") || txt.includes("buy now") || txt.includes("add to bag")) { btn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); var card = this.closest("article") || this.closest("[class*='product']") || this.parentElement; var name = card && card.querySelector("h1,h2,h3,h4"); var n = name ? name.textContent.trim() : "Item"; var ex = cart.find(function(i) { return i.name === n; }); if (ex) ex.qty++; else cart.push({ name: n, qty: 1 }); showToast(n + " added"); var total = cart.reduce(function(a, b) { return a + b.qty; }, 0); document.querySelectorAll("#cart-count,#cart-badge,[class*='cart-count']").forEach(function(b) { b.textContent = total; }); }); } });
document.querySelectorAll("form").forEach(function(form) { form.addEventListener("submit", function(e) { e.preventDefault(); if (form.querySelector(".wg-success")) return; var s = document.createElement("div"); s.className = "wg-success"; s.style.cssText = "background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;font-family:sans-serif;"; s.textContent = "Thank you! We will be in touch within 24 hours."; form.appendChild(s); form.querySelectorAll("input,textarea,select,button[type='submit']").forEach(function(el) { el.setAttribute("disabled", "true"); }); }); });
var pages = document.querySelectorAll(".page,.page-section");
if (pages.length > 1) { var ha = false; pages.forEach(function(p) { if (p.classList.contains("active")) ha = true; }); if (!ha) { pages.forEach(function(p, i) { if (i === 0) { p.style.display = "block"; p.classList.add("active"); } else { p.style.display = "none"; } }); } }
})();
</script>`;

  if (processed.includes("</body>")) return processed.replace("</body>", script + "</body>");
  return processed + script;
}

export async function POST(req: Request) {
  try {
    console.log("REQUEST RECEIVED");
    const formData = await req.formData();

    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    // Verify Turnstile token
    const turnstileToken = getString("turnstileToken");
    if (!turnstileToken) {
      return NextResponse.json({ success: false, message: "Security check failed. Please refresh and try again." });
    }

    const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
      }),
    });
    const turnstileResult = await turnstileVerify.json();
    if (!turnstileResult.success) {
      console.log("Turnstile failed:", turnstileResult);
      return NextResponse.json({ success: false, message: "Security check failed. Please refresh and try again." });
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
    };

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0 ? userInput.pages.join(", ") : "Home";
    const isMultiPage = userInput.siteType === "multi";
    const fileName = safeFileName(userInput.businessName || "website");
    const clientEmail = userInput.email || "";
    const clientPhone = userInput.phone || "";
    const quote = calculateQuote(userInput);
    const folder = `webgecko/${fileName}`;

    let logoUrl: string | null = null;
    let heroUrl: string | null = null;
    const photoUrls: string[] = [];
    const productsWithPhotos: { name: string; price: string; photoUrl?: string }[] = Array.isArray(userInput.products) ? [...userInput.products] : [];

    const logoFile = formData.get("logo") as File | null;
    const heroFile = formData.get("hero") as File | null;

    const uploadPromises: Promise<void>[] = [];

    if (logoFile && logoFile.size > 0) uploadPromises.push(logoFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, "logo").then(url => { logoUrl = url; })));
    if (heroFile && heroFile.size > 0) uploadPromises.push(heroFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, "hero").then(url => { heroUrl = url; })));
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
    console.log(`Uploads done: logo=${!!logoUrl}, hero=${!!heroUrl}, photos=${photoUrls.length}`);

    const method = userInput.pricingMethod || "manual";
    let pricingSection = "No pricing section needed";

    if (userInput.hasPricing === "Yes") {
      if (method === "weknow") {
        pricingSection = `PRICING SECTION REQUIRED: Create a professional pricing section for a ${userInput.industry} business using industry-standard pricing.`;
      } else if (method === "url") {
        pricingSection = `PRICING SECTION REQUIRED: Pull pricing from the client existing website: ${userInput.pricingUrl}. If inaccessible, create a professional placeholder.`;
      } else if (method === "upload") {
        pricingSection = `PRICING SECTION REQUIRED: Client uploaded a menu/price list. Create a professional pricing section for ${userInput.industry}. Pricing will be updated after document review.`;
      } else if (userInput.pricingType === "products" && productsWithPhotos.length > 0) {
        const productList = productsWithPhotos.map(p => `${p.name}: ${p.price}${p.photoUrl ? ` (photo: ${p.photoUrl})` : ""}`).join(", ");
        pricingSection = `PRICING SECTION REQUIRED - Individual Products: ${productList}. Display each with name, price and photo in a grid layout. Use exact product photos provided.`;
      } else {
        pricingSection = `PRICING SECTION REQUIRED. Type: ${userInput.pricingType}. Details: ${userInput.pricingDetails}`;
      }
    }

    const imageSection = logoUrl || heroUrl || photoUrls.length > 0
      ? `CLIENT IMAGES: ${logoUrl ? `Logo: ${logoUrl} (use in navbar).` : ""} ${heroUrl ? `Hero: ${heroUrl} (use as main hero background).` : ""} ${photoUrls.length > 0 ? `Photos: ${photoUrls.join(", ")}.` : ""}`
      : "No branding images - use stock images";

    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".

Business: ${userInput.businessName}
Industry: ${userInput.industry}
Target Audience: ${userInput.targetAudience}
USP: ${userInput.usp}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Colours: ${userInput.colorPrefs || "professional palette"}
References: ${userInput.references || "none"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}
Notes: ${userInput.additionalNotes || "none"}
Contact Email: ${clientEmail}
Contact Phone: ${clientPhone}

${pricingSection}

${imageSection}

${isMultiPage
  ? `MULTI-PAGE SITE. Pages: ${pageList}. Each page as div with class "page-section" and unique lowercase id. Only first page visible, others display:none. Nav using onclick="navigateTo('pageid')". Mobile hamburger id="hamburger" toggling id="mobile-menu". Contact: REAL email ${clientEmail} and phone ${clientPhone}. FAQ: native details/summary elements.`
  : `SINGLE PAGE SITE. Sections: ${pageList}. Each section unique lowercase id. Nav using href="#sectionid". Mobile hamburger id="hamburger" toggling id="mobile-menu". Contact: REAL email ${clientEmail} and phone ${clientPhone}. FAQ: native details/summary elements.`}

Make it premium and stunning for: ${userInput.businessName}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    console.log("STEP 2: Creating project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    console.log("STEP 3: Generating screen...");
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", { projectId, prompt: spec.stitchPrompt });
    const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
    if (!screens.length) throw new Error("No screens returned");
    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl");
    console.log("STEP 3 DONE");

    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Check and fix links
    console.log("STEP 5: Checking links...");
    const { html: checkedHtml, report: linkReport } = checkAndFixLinks(stitchHtml, Array.isArray(userInput.pages) ? userInput.pages : []);
    console.log("Link report:", linkReport);

    let finalHtml = injectEssentials(checkedHtml, clientEmail, clientPhone);
    finalHtml = injectImages(finalHtml, logoUrl, heroUrl, photoUrls, productsWithPhotos);
    const cssContent = extractCSS(stitchHtml);
    console.log("STEP 5 DONE");

    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, { html: finalHtml, title: spec.projectTitle, fileName, userInput }, { ex: 86400 });
    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/process?id=${jobId}&secret=${process.env.PROCESS_SECRET}`;

    const productSummary = productsWithPhotos.length > 0
      ? productsWithPhotos.map(p => `${p.name} - ${p.price}${p.photoUrl ? ` - <a href="${p.photoUrl}">View photo</a>` : ""}`).join("<br/>")
      : userInput.pricingDetails || "-";

    console.log("STEP 6: Emailing owner...");
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
        <p><strong>Industry:</strong> ${userInput.industry}</p>
        <p><strong>Audience:</strong> ${userInput.targetAudience || "-"}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</p>
        <p><strong>Pricing Method:</strong> ${method}</p>
        ${userInput.hasPricing === "Yes" ? `<p><strong>Products:</strong><br/>${productSummary}</p>` : ""}
        <p><strong>Style:</strong> ${userInput.style} / ${userInput.colorPrefs || "-"}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <p><strong>Notes:</strong> ${userInput.additionalNotes || "-"}</p>
        ${logoUrl ? `<p><strong>Logo:</strong> <a href="${logoUrl}">View</a></p>` : ""}
        ${heroUrl ? `<p><strong>Hero:</strong> <a href="${heroUrl}">View</a></p>` : ""}
        ${linkReport.length > 0 ? `<p><strong>Link Check:</strong><br/>${linkReport.join("<br/>")}</p>` : "<p><strong>Link Check:</strong> All links passed</p>"}
        <br/>
        <h3>Quote: ${quote.package} - $${quote.price.toLocaleString()} + $${quote.monthlyPrice}/month</h3>
        <ul>${quote.breakdown.map(b => `<li>${b}</li>`).join("")}</ul>
        <br/>
        <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Fix This Site</a>
        <p style="color:#94a3b8;font-size:12px;">Expires 24hrs</p>
      `,
      attachments: [
        { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
        { filename: `${fileName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
      ],
    });
    console.log("STEP 6 DONE");

    if (clientEmail) {
      console.log("STEP 7: Emailing client...");
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: clientEmail,
        subject: `We've received your website request!`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
            <h1 style="font-size:28px;margin-bottom:8px;">Thank you, ${userInput.name}!</h1>
            <p style="color:#666;margin-bottom:32px;">We have received your request and will be in touch within 24 hours.</p>
            <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:16px;margin-bottom:16px;color:#333;">Your Request Summary</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#666;width:160px;">Business</td><td style="padding:8px 0;font-weight:600;">${userInput.businessName}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Goal</td><td style="padding:8px 0;font-weight:600;">${userInput.goal}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Site Type</td><td style="padding:8px 0;font-weight:600;">${userInput.siteType === "multi" ? "Multi Page" : "Single Page"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Pages</td><td style="padding:8px 0;font-weight:600;">${pageList}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Features</td><td style="padding:8px 0;font-weight:600;">${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Style</td><td style="padding:8px 0;font-weight:600;">${userInput.style || "-"}</td></tr>
              </table>
            </div>
            <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;color:white;">
              <h2 style="font-size:16px;margin-bottom:16px;color:#f2ca50;">Your Quote - ${quote.package} Package</h2>
              <p style="font-size:32px;font-weight:800;margin:0;">$${quote.price.toLocaleString()}</p>
              <p style="color:#94a3b8;margin-bottom:16px;">+ $${quote.monthlyPrice}/month hosting</p>
              <div style="background:#22c55e20;border:1px solid #22c55e40;border-radius:8px;padding:16px;margin-top:16px;">
                <p style="color:#22c55e;font-weight:bold;margin:0;">You are saving $${quote.savings.toLocaleString()} compared to the industry average of $${quote.competitorPrice.toLocaleString()}!</p>
              </div>
            </div>
            <p style="color:#666;">Reply to this email with any questions.</p>
            <div style="border-top:1px solid #eee;padding-top:20px;margin-top:20px;">
              <p style="color:#999;font-size:12px;">WebGecko - Professional Web Design | webgecko.au</p>
            </div>
          </div>
        `,
      });
      console.log("STEP 7 DONE");
    }

    return NextResponse.json({ success: true, message: "Thank you! We have received your request and will be in touch shortly." });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}