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
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME!, api_key: process.env.CLOUDINARY_API_KEY!, api_secret: process.env.CLOUDINARY_API_SECRET! });

function extractJson(text: string) {
  try { return JSON.parse(text); } catch {}
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
  return `/* WebGecko Styles */\n\n${styleBlocks.join("\n\n")}`;
}

async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, public_id: filename, overwrite: true }, (error, result) => { if (error) reject(error); else resolve(result!.secure_url); });
    stream.end(buffer);
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    // 1. TURNSTILE VERIFY
    const turnstileToken = getString("turnstileToken");
    const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
    });
    const tRes = await turnstileVerify.json();
    if (!tRes.success) return NextResponse.json({ success: false, message: "Security failure" });

    const userInput = {
      businessName: getString("businessName"),
      industry: getString("industry"),
      email: getString("email"),
      phone: getString("phone"),
      pages: getJson("pages"),
      siteType: getString("siteType")
    };

    const fileName = safeFileName(userInput.businessName);
    const folder = `webgecko/${fileName}`;

    // 2. PARALLEL UPLOADS
    let logoUrl = "";
    const logoFile = formData.get("logo") as File | null;
    const uploadPromises = [];
    if (logoFile) {
      uploadPromises.push(logoFile.arrayBuffer().then(buf => uploadToCloudinary(Buffer.from(buf), folder, "logo").then(url => logoUrl = url)));
    }
    await Promise.all(uploadPromises);

    // 3. CLAUDE PASS 1: Stitch Prompt (Industry Research Instruction Included)
    const specResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1500,
      messages: [{ role: "user", content: `Return JSON: {"projectTitle": "...", "stitchPrompt": "..."}. Research the ${userInput.industry} industry. Build a premium unique site for ${userInput.businessName}. Pages: ${userInput.pages.join(",")}. Style: Premium Dark with glassmorphism.` }]
    });

    const spec = extractJson(specResponse.content[0].text);
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project.name.split("/")[1];

    // 4. STITCH GENERATION
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", { projectId, prompt: spec.stitchPrompt });
    const rawHtml = await fetch(stitchResult.outputComponents[0].design.screens[0].htmlCode.downloadUrl).then(r => r.text());

    // 5. CLAUDE PASS 2: Multi-Page Fixer & Link Checker
    const fixPass = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8000,
      messages: [{ role: "user", content: `You are a senior dev. Fix this HTML. 
      1. SiteType is ${userInput.siteType}. If "multi", pages ${userInput.pages.join(",")} must be hidden sections toggled by navigateTo().
      2. Insert contact: ${userInput.email} / ${userInput.phone}.
      3. No explanatory text. Return ONLY HTML.
      
      HTML: ${rawHtml}` }]
    });

    const finalHtml = fixPass.content[0].text;
    const cssContent = extractCSS(rawHtml);

    // 6. REDIS STORAGE & EMAIL
    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, { html: finalHtml, userInput }, { ex: 86400 });

    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Request: ${userInput.businessName}`,
      html: `<h2>Website Ready</h2><p>Business: ${userInput.businessName}</p>`,
      attachments: [
        { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
        { filename: `styles.css`, content: Buffer.from(cssContent).toString("base64") }
      ]
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}