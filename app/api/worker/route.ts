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

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ")
      : "Home";

    // STEP 1: Claude writes Stitch prompt
    console.log("STEP 1: Calling Claude for spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON:
{
  "projectTitle": "string",
  "stitchPrompt": "string"
}

Generate a premium Stitch website prompt for this brief:
${JSON.stringify(userInput)}

Pages needed: ${pageList}
Goal: ${userInput.goal || "generate leads"}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    // STEP 2: Create Stitch project
    console.log("STEP 2: Creating Stitch project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    // STEP 3: Generate screen
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

    // STEP 4: Fetch Stitch HTML
    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Claude ONLY injects interactions — never touches layout
    console.log("STEP 5: Claude injecting interactions...");
    const fixResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `You are a JavaScript interaction injector. Your ONLY job is to make buttons and navigation work.

STRICT RULES:
- DO NOT change any HTML structure
- DO NOT change any CSS or classes
- DO NOT rename any elements
- DO NOT rewrite any sections
- DO NOT change any text content
- DO NOT change colors, fonts, spacing
- ONLY add or fix JavaScript

WHAT TO FIX:
1. Find the mobile hamburger/menu button — make it toggle the mobile nav open/closed
2. Find all nav links — make them smooth scroll to their matching section id
3. Find all CTA buttons — make them scroll to the nearest relevant section (contact, booking, gallery, shop)
4. Find any modal triggers — make them open/close their modal
5. Find any forms — make them show a success message on submit
6. Add section ids if they are missing so scroll targets work

OUTPUT: Return the complete HTML with only JavaScript added or fixed. Start with <!DOCTYPE html>.

HTML TO FIX:
${stitchHtml}`
      }]
    });

    const fixText = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : stitchHtml;
    const finalHtml = extractHtml(fixText);
    console.log("STEP 5 DONE. Final length:", finalHtml.length);

    // STEP 6: Send email
    console.log("STEP 6: Sending email...");
    const emailResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Website - ${spec.projectTitle}`,
      html: "<p>Your website is attached.</p>",
      attachments: [{ filename: "site.html", content: Buffer.from(finalHtml).toString("base64") }],
    });
    console.log("STEP 6 DONE:", JSON.stringify(emailResult));

    return NextResponse.json({ success: true, message: "Website sent to your email!" });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}