export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

function extractHtml(text: string) {
  const start = text.indexOf("<!DOCTYPE");
  if (start !== -1) return text.slice(start);
  const h = text.indexOf("<html");
  if (h !== -1) return text.slice(h);
  return text;
}

function compressHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";

    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".
Brief: ${JSON.stringify(userInput)}
Pages: ${pageList}
Goal: ${userInput.goal || "generate leads"}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    console.log("STEP 2: Creating Stitch project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    console.log("STEP 3: Generating screen...");
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
      projectId,
      prompt: spec.stitchPrompt,
    });

    const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
    if (!screens.length) throw new Error("No screens returned");
    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl");
    console.log("STEP 3 DONE");

    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    const compressed = compressHtml(stitchHtml);
    console.log("Compressed length:", compressed.length);

    console.log("STEP 5: Claude fixing interactions...");
    const fixResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `Fix button interactions in this HTML.

RULES:
- Return COMPLETE HTML, do not truncate
- Do NOT change design, layout, CSS, colors or text
- ONLY add JavaScript for:
  1. Hamburger toggles mobile nav
  2. Nav links smooth scroll to section ids
  3. CTA buttons scroll to contact/relevant section
  4. Forms show success message on submit
  5. Add missing section ids where needed

Return complete HTML starting with <!DOCTYPE html>

HTML:
${compressed}`
      }]
    });

    const fixText = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : stitchHtml;
    const finalHtml = extractHtml(fixText);
    console.log("STEP 5 DONE. Final length:", finalHtml.length);

    console.log("STEP 6: Sending email...");
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Website - ${spec.projectTitle}`,
      html: "<p>Your website is attached.</p>",
      attachments: [{ filename: "site.html", content: Buffer.from(finalHtml).toString("base64") }],
    });
    console.log("STEP 6 DONE");

    return NextResponse.json({ success: true, message: "Website sent to your email!" });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}