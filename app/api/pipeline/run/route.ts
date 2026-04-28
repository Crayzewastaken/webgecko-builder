// app/api/pipeline/run/route.ts
// Full Stitch + Claude build pipeline.
// Triggered by Square webhook (POST) after deposit paid, or manually (GET) by owner.

export const maxDuration = 60; // Inngest handles long runs, this endpoint is rarely called directly
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";
import { generateBookingWidget } from "@/lib/booking-widget";
import {
  extractJson,
  safeFileName,
  extractCSS,
  checkAndFixLinks,
  injectEssentials,
  injectImages,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Core pipeline ────────────────────────────────────────────────────────────

export async function runPipeline(jobId: string): Promise<{ success: boolean; error?: string }> {
  const job = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId);
  if (!job) return { success: false, error: "Job not found" };
  if (job.status === "building") return { success: false, error: "Already building" };
  if (job.status === "complete") return { success: false, error: "Already complete" };

  await redis.set(`job:${jobId}`, { ...job, status: "building" }, { ex: 86400 * 30 });

  const {
    userInput, logoUrl, heroUrl,
    photoUrls = [], productsWithPhotos = [],
    hasBooking, clientSlug,
    email: clientEmail, phone: clientPhone,
  } = job;

  const fileName = job.fileName || safeFileName(userInput.businessName);
  const features: string[] = Array.isArray(userInput.features) ? userInput.features : [];
  const hasBookingFeature = hasBooking || features.includes("Booking System");
  const isMultiPage = userInput.siteType === "multi";
  const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
    ? userInput.pages.join(", ") : "Home";

  // Rebuild booking widget HTML (availability config already saved during intake)
  let bookingWidgetHtml = "";
  if (hasBookingFeature) {
    try {
      const services = getServicesForIndustry(userInput.industry);
      bookingWidgetHtml = generateBookingWidget({
        jobId, businessName: userInput.businessName,
        timezone: "Australia/Brisbane",
        services, primaryColor: "#10b981",
        apiBase: process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app",
      });
    } catch (e) { console.error("Booking widget failed:", e); }
  }

  // Build pricing section string
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

  const imageSection = logoUrl || heroUrl || photoUrls.length > 0
    ? `CLIENT IMAGES — use these exact URLs: ${logoUrl ? `Logo: ${logoUrl}` : ""} ${heroUrl ? `Hero: ${heroUrl}` : ""} ${photoUrls.length > 0 ? `Photos: ${photoUrls.join(", ")}` : ""}`
    : "No client images provided — use relevant stock image placeholders.";

  // STEP 1: Claude spec
  console.log(`PIPELINE [${jobId}] STEP 1: Generating spec...`);
  const promptResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `Your response must be ONLY a JSON object. Start with { and end with }. No text before or after. No markdown. No backticks.

The JSON must have exactly two keys: "projectTitle" (short string) and "stitchPrompt" (detailed design brief string).

You are a senior UI designer. Design a premium, distinctive website for the business below. Research the ${userInput.industry} industry. Think about top-tier websites in this space. Create something better than average — distinctive, conversion-focused, and premium.

BUSINESS CONTEXT:
Business: ${userInput.businessName}
Industry: ${userInput.industry}
Target Audience: ${userInput.targetAudience || "general public"}
USP: ${userInput.usp || "quality service"}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Colours: ${userInput.colorPrefs || "professional palette"}
References: ${userInput.references || "none"}
Features: ${features.join(", ") || "contact form"}
Notes: ${userInput.additionalNotes || "none"}
Contact Email: ${clientEmail}
Contact Phone: ${clientPhone}

${pricingSection}
${hasBookingFeature ? `BOOKING: Include a booking section with id="booking". The booking widget will be injected here.` : ""}
${imageSection}

DESIGN REQUIREMENTS — include ALL in the stitchPrompt:
1. HERO: Full viewport height, bold headline 60-80px, subheadline, CTA button, distinctive background (gradient/dark overlay/pattern — NOT plain white)
2. NAV: Sticky, logo left, links right, CTA button, mobile hamburger id="hamburger" toggling id="mobile-menu", glassmorphism or solid dark background
3. LAYOUTS: Mix — full-width sections, 50/50 splits, asymmetric grids, stat counters, testimonials with names and star ratings
4. TYPOGRAPHY: Bold display font for headings, clean sans-serif body, generous spacing
5. COLOUR: Use ${userInput.colorPrefs || "professional premium palette"}, dark backgrounds where appropriate, accent colour for CTAs
6. TRUST: Star-rated testimonials with realistic Australian names, stats bar
7. CONTACT: Use REAL email ${clientEmail} and REAL phone ${clientPhone}, working contact form
8. FOOTER: Logo, links, contact, social, copyright

${isMultiPage
  ? `CRITICAL — MULTI-PAGE SITE: Pages: ${pageList}.
- Each page MUST be a div with class="page-section" and unique lowercase id (e.g. id="home", id="services")
- ONLY the first page div visible (style="display:block"), ALL others MUST have style="display:none"
- ALL nav links MUST use onclick="navigateTo('pageid')" — NOT href links
- Add id="hamburger" button toggling id="mobile-menu"`
  : `SINGLE PAGE SITE: Sections: ${pageList}. Each section has unique lowercase id. Nav links use href="#sectionid". Smooth scroll.`}

Make it premium, unique and conversion-focused for: ${userInput.businessName}`
    }]
  });

  const promptText = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
  const spec = extractJson(promptText);
  console.log(`PIPELINE [${jobId}] STEP 1 DONE: ${spec.projectTitle}`);

  // STEP 2: Create Stitch project
  console.log(`PIPELINE [${jobId}] STEP 2: Creating Stitch project...`);
  const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
  const projectId = project?.name?.split("/")[1];
  if (!projectId) throw new Error("Stitch: no projectId returned");
  console.log(`PIPELINE [${jobId}] STEP 2 DONE: ${projectId}`);

  // STEP 3: Generate screen with Stitch
  console.log(`PIPELINE [${jobId}] STEP 3: Stitch generating screen...`);
  const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
    projectId,
    prompt: spec.stitchPrompt,
  });
  const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
  if (!screens.length) throw new Error("Stitch: no screens returned");
  const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
  if (!downloadUrl) throw new Error("Stitch: no downloadUrl");
  console.log(`PIPELINE [${jobId}] STEP 3 DONE`);

  // STEP 4: Fetch raw HTML from Stitch
  console.log(`PIPELINE [${jobId}] STEP 4: Fetching HTML...`);
  const stitchHtml = await fetch(downloadUrl).then(r => r.text());
  console.log(`PIPELINE [${jobId}] STEP 4 DONE. Length: ${stitchHtml.length}`);

  // STEP 5: Claude post-processor (Haiku — strict, preserves Stitch HTML)
  console.log(`PIPELINE [${jobId}] STEP 5: Claude fix pass...`);
  const businessAddress = userInput.businessAddress || "";
  const googleMapsEmbed = businessAddress && process.env.GOOGLE_MAPS_API_KEY
    ? `<iframe width="100%" height="350" style="border:0;border-radius:12px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe>`
    : "";

  const fixPrompt = `You are a STRICT HTML post-processor for a production web design system.
You are NOT a designer. You must NOT change layout, structure, styling, or Tailwind classes.
Preserve the Stitch-generated HTML EXACTLY except for the specific fixes below.

=== HARD RULES ===
- DO NOT move elements, redesign sections, change Tailwind classes, or rename IDs
- DO NOT convert onclick="navigateTo(...)" to href links
- DO NOT invent new sections or add features not listed
- PRESERVE all content, copy, images, colors from Stitch

=== NAVIGATE-TO ID FIX (do this first) ===
For every navigateTo('x') call, check if id="x" exists. If missing:
- Find the most relevant section (match by class name, heading text, or position) and add id="x" to its opening tag
- If no match: insert <div id="x" style="position:relative;top:-80px;visibility:hidden;pointer-events:none;height:0;"></div> before </body>
NEVER leave a navigateTo() without a matching id.

=== CTA BUTTON FIX ===
Hero CTA buttons with href="#" or no action (text: Join Now, Book Now, Get Started, Sign Up, etc.):
- If id="booking" exists: add onclick="document.getElementById('booking').scrollIntoView({behavior:'smooth'})"
- Else: add onclick="document.getElementById('contact')?.scrollIntoView({behavior:'smooth'})"

=== CONTACT DETAILS ===
Replace placeholder emails/phones:
- Any example@, info@, hello@, contact@ → ${clientEmail}
- Any 555-, (555), fake numbers → ${clientPhone}

=== MULTI-PAGE: "${userInput.siteType.toUpperCase()}" ===
${isMultiPage
  ? `Ensure page divs have class="page-section" and ids matching: ${pageList}. Only first page visible (display:block), others display:none. Keep all onclick="navigateTo(...)" exactly as-is.`
  : `Single page, all sections visible, nav uses href="#sectionid".`}

${googleMapsEmbed ? `=== MAP ===\nInject inside existing map/location section: ${googleMapsEmbed}` : ""}

${hasBookingFeature && bookingWidgetHtml
  ? `=== BOOKING ===\nReplace placeholder content INSIDE existing id="booking" section (do NOT create a new section) with:\n${bookingWidgetHtml.substring(0, 3000)}`
  : ""}

=== OUTPUT ===
Return FULL HTML document. No explanations, no markdown, no backticks. Must start with <!DOCTYPE html> or <html>.

HTML TO PROCESS:
${stitchHtml.substring(0, 72000)}`;

  const fixResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: fixPrompt }],
  });

  let fixedHtml = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : "";
  fixedHtml = fixedHtml.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!fixedHtml || (!fixedHtml.includes("<html") && !fixedHtml.includes("<!DOCTYPE") && !fixedHtml.includes("<body"))) {
    console.log(`PIPELINE [${jobId}] STEP 5: Response invalid, using original Stitch HTML`);
    fixedHtml = stitchHtml;
  } else {
    console.log(`PIPELINE [${jobId}] STEP 5 DONE. Length: ${fixedHtml.length}`);
  }

  // STEP 6: Link check + fix
  const { html: checkedHtml, report: linkReport } = checkAndFixLinks(
    fixedHtml,
    Array.isArray(userInput.pages) ? userInput.pages : []
  );

  // STEP 7: Inject essentials (navigateTo, hamburger, forms, cart) + images
  let finalHtml = injectEssentials(checkedHtml, clientEmail, clientPhone);
  finalHtml = injectImages(finalHtml, logoUrl, heroUrl, photoUrls, productsWithPhotos);
  const cssContent = extractCSS(fixedHtml);
  console.log(`PIPELINE [${jobId}] STEP 7 DONE`);

  // STEP 8: Deploy to Vercel
  console.log(`PIPELINE [${jobId}] STEP 8: Deploying to Vercel...`);
  const safeName = fileName.slice(0, 40);
  let previewUrl = "";
  try {
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${safeName}-${Date.now()}`,
        teamId: process.env.VERCEL_TEAM_ID,
        files: [{ file: "index.html", data: finalHtml, encoding: "utf-8" }],
        projectSettings: { framework: null, outputDirectory: "./" },
      }),
    });
    if (deployRes.ok) {
      const deployData = await deployRes.json();
      previewUrl = `https://${deployData.url}`;
      console.log(`PIPELINE [${jobId}] STEP 8 DONE: ${previewUrl}`);
    } else {
      console.error(`PIPELINE [${jobId}] STEP 8: Deploy failed:`, await deployRes.text());
    }
  } catch (e) { console.error(`PIPELINE [${jobId}] Deploy error:`, e); }

  // STEP 9: Update Redis
  const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fix?id=${jobId}&secret=${encodeURIComponent(process.env.PROCESS_SECRET || "")}`;
  const unlockUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/unlock?jobId=${jobId}&secret=${encodeURIComponent(process.env.PROCESS_SECRET || "")}`;
  const releaseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/unlock/release?jobId=${jobId}&secret=${encodeURIComponent(process.env.PROCESS_SECRET || "")}`;
  const bookingsUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/c/${clientSlug}/bookings`;

  await redis.set(`job:${jobId}`, {
    ...job,
    html: finalHtml,
    title: spec.projectTitle,
    fileName,
    status: "complete",
    previewUrl,
    builtAt: new Date().toISOString(),
  }, { ex: 86400 * 30 });

  if (clientSlug) {
    const existingClient = await redis.get<any>(`client:${clientSlug}`);
    if (existingClient) {
      await redis.set(`client:${clientSlug}`, {
        ...existingClient,
        previewUrl,
        buildStatus: "complete",
        builtAt: new Date().toISOString(),
      });
    }
  }

  // STEP 10: Email owner with HTML attachments + action buttons
  console.log(`PIPELINE [${jobId}] STEP 10: Emailing owner...`);
  try {
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `✅ Build Complete — ${spec.projectTitle}`,
      html: `
        <h2>Website Built — ${spec.projectTitle}</h2>
        <p><strong>Client:</strong> ${userInput.name} (${clientEmail})</p>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Industry:</strong> ${userInput.industry}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${features.join(", ") || "-"}</p>
        <p><strong>Link Check:</strong> ${linkReport.length > 0 ? linkReport.join(", ") : "All clear"}</p>
        ${previewUrl ? `<p><a href="${previewUrl}" style="color:#22c55e;">🌐 View Preview</a></p>` : ""}
        <br/>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="${releaseUrl}" style="background:#00c896;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">📤 Release to Client</a>
          <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔧 Fix This Site</a>
          <a href="${unlockUrl}" style="background:#8b5cf6;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">🔓 Unlock Final Payment</a>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:12px;">HTML and CSS files attached below.</p>
      `,
      attachments: [
        { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
        { filename: `${fileName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
      ],
    });
    console.log(`PIPELINE [${jobId}] STEP 10 DONE`);
  } catch (e) { console.error(`PIPELINE [${jobId}] Owner email failed:`, e); }

  console.log(`PIPELINE [${jobId}] COMPLETE`);
  return { success: true };
}

// ─── GET — manual trigger by owner ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || searchParams.get("id");
  const secret = searchParams.get("secret");

  if (!jobId || secret !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const result = await runPipeline(jobId).catch(err => ({ success: false, error: err.message }));

  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:white;padding:40px;text-align:center;">
      <h1 style="color:${result.success ? "#22c55e" : "#ef4444"}">${result.success ? "✅ Build Complete" : "❌ Build Failed"}</h1>
      <p>${result.error || "Site built. Check your email for the HTML files and action buttons."}</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// ─── POST — triggered by webhook ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { jobId, secret } = body;

  if (!jobId || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Await the pipeline (maxDuration=300s, pipeline takes ~2-3 min)
    const result = await runPipeline(jobId);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`Pipeline failed for ${jobId}:`, err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}