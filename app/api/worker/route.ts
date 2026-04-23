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
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No valid JSON found in response");
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
  return `/* WebGecko Generated Styles */\n\n${styleBlocks.join("\n\n")}`;
}

function calculateQuote(userInput: any) {
  const pageCount = Array.isArray(userInput.pages) ? userInput.pages.length : 1;
  const features = Array.isArray(userInput.features) ? userInput.features : [];
  const isMultiPage = userInput.siteType === "multi";
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  
  let packageName = "Starter"; let basePrice = 1800; let competitorPrice = 3500;
  if (pageCount >= 8 || hasEcommerce || hasBooking) { packageName = "Premium"; basePrice = 5500; competitorPrice = 15000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = "Business"; basePrice = 3200; competitorPrice = 7500; }
  
  let addons = 0;
  if (features.includes("Live Chat")) addons += 150;
  if (features.includes("Newsletter Signup")) addons += 100;
  
  const totalPrice = basePrice + addons;
  const monthlyPrice = packageName === "Premium" ? 149 : packageName === "Business" ? 99 : 79;
  return { package: packageName, price: totalPrice, monthlyPrice, savings: competitorPrice - totalPrice, competitorPrice };
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

function injectImages(html: string, logoUrl: string | null, heroUrl: string | null, photoUrls: string[], products: any[]): string {
  let processed = html;
  const script = `
<script>
(function() {
  ${logoUrl ? `
  var logoUrl = "${logoUrl}";
  var header = document.querySelector("header, nav, [class*='navbar'], [class*='nav']");
  if (header) {
    var existingLogo = header.querySelector("img");
    if (existingLogo) { existingLogo.src = logoUrl; existingLogo.style.height = "40px"; }
    else {
      var textLogo = header.querySelector("[class*='logo'],[class*='brand']");
      if (textLogo) { textLogo.innerHTML = '<img src="' + logoUrl + '" style="height:40px;width:auto;object-fit:contain;">'; }
    }
  }` : ""}
  ${heroUrl ? `var hero = document.querySelector("[class*='hero'],section"); if(hero) hero.style.backgroundImage = "url('${heroUrl}')";` : ""}
})();
</script>`;
  return processed.replace("</body>", script + "</body>");
}

function injectEssentials(html: string, email: string, phone: string): string {
  let processed = html;
  processed = processed.replace(/hello@webgecko.au/g, email).replace(/0400000000/g, phone);
  return processed;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    const turnstileToken = getString("turnstileToken");
    if (!turnstileToken) return NextResponse.json({ success: false, message: "Security check failed." });

    const userInput = {
      businessName: getString("businessName"),
      industry: getString("industry"),
      usp: getString("usp"),
      targetAudience: getString("targetAudience"),
      goal: getString("goal"),
      siteType: getString("siteType"),
      pages: getJson("pages"),
      features: getJson("features"),
      style: getString("style"),
      email: getString("email"),
      phone: getString("phone")
    };

    const quote = calculateQuote(userInput);
    const fileName = safeFileName(userInput.businessName);
    const isMultiPage = userInput.siteType === "multi";
    const pageList = userInput.pages.join(", ");

    // Parallel Image Upload
    let logoUrl: string | null = null;
    let heroUrl: string | null = null;
    const logoFile = formData.get("logo") as File | null;
    const heroFile = formData.get("hero") as File | null;
    const uploadPromises = [];
    if (logoFile && logoFile.size > 0) uploadPromises.push(logoFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), `webgecko/${fileName}`, "logo").then(url => logoUrl = url)));
    if (heroFile && heroFile.size > 0) uploadPromises.push(heroFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), `webgecko/${fileName}`, "hero").then(url => heroUrl = url)));
    await Promise.all(uploadPromises);

    // STEP 1: SPEC GEN
    const promptResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return JSON only: {"projectTitle": "...", "stitchPrompt": "..."}.
        Design a PREMIUM, UNIQUE ${userInput.industry} website. Style: ${userInput.style}.
        ${isMultiPage ? `CRITICAL: Multi-page. Create separate sections for ${pageList}. Only first visible. Use onclick="navigateTo('id')".` : `Single page with sections for ${pageList}.`}
        Use REAL contact: ${userInput.email} / ${userInput.phone}.`
      }]
    });

    const spec = extractJson(promptResponse.content[0].text);

    // STEP 2: STITCH GEN
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", { projectId, prompt: spec.stitchPrompt });
    const downloadUrl = stitchResult?.outputComponents[0].design.screens[0].htmlCode.downloadUrl;
    const rawHtml = await fetch(downloadUrl).then(r => r.text());

    // STEP 3: CLAUDE FIX PASS
    const fixResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `Fix this HTML. Return ONLY the code.
        1. Site is ${userInput.siteType.toUpperCase()}. 
        2. Replace all placeholder emails with ${userInput.email}.
        3. Make sure id="hamburger" toggles id="mobile-menu".
        4. Fix all dead buttons to scroll to contact.
        HTML: ${rawHtml.substring(0, 75000)}`
      }]
    });

    let fixedHtml = fixResponse.content[0].text.replace(/^```html|```$/g, "").trim();
    let finalHtml = injectEssentials(fixedHtml, userInput.email, userInput.phone);
    finalHtml = injectImages(finalHtml, logoUrl, heroUrl, [], []);

    // STEP 4: SEND
    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, { html: finalHtml, userInput }, { ex: 86400 });

    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Request - ${userInput.businessName}`,
      html: `<p>Project complete. Quote: $${quote.price}.</p>`,
      attachments: [{ filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") }]
    });

    return NextResponse.json({ success: true, message: "Website sent to email!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}