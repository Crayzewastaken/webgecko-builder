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

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ")
      : "Home";

    const isMultiPage = Array.isArray(userInput.pages) && userInput.pages.length > 1;

    console.log("STEP 1: Calling Claude...");
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

You are generating a premium Stitch website prompt.

CLIENT BRIEF:
${JSON.stringify(userInput)}

REQUIRED PAGES: ${pageList}
ARCHITECTURE: ${isMultiPage ? "Multi-page website. Create a separate section or page for each: " + pageList : "Single page with anchor sections for: " + pageList}

CRITICAL INTERACTION RULES:
- every navbar link must navigate to its matching page section
- hamburger icon must open/close mobile menu
- all CTA buttons must link to a real section or page
- contact/booking buttons must scroll to or open a contact form
- no dead buttons
- no placeholder links
- every button must do something visible
- all forms must have a visible submit action

CRITICAL STRUCTURE RULES:
- build exactly these pages/sections: ${pageList}
- each nav item must match a real destination
- goal of site is: ${userInput.goal || "generate leads"}
- style: ${userInput.style || "modern premium"}
- features needed: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}

Generate the best premium Stitch prompt for this.`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    console.log("STEP 1 DONE:", text.slice(0, 150));
    const spec = extractJson(text);

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
    console.log("STEP 3 screen count:", screens.length);
    if (!screens.length) throw new Error("No screens returned");

    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl");
    console.log("STEP 3 DONE");

    console.log("STEP 4: Fetching HTML...");
    const html = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", html.length);

    console.log("STEP 5: Sending email...");
    const emailResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Website - ${spec.projectTitle}`,
      html: "<p>Your website is attached.</p>",
      attachments: [{ filename: "site.html", content: Buffer.from(html).toString("base64") }],
    });
    console.log("STEP 5 DONE:", JSON.stringify(emailResult));

    return NextResponse.json({ success: true, message: "Website sent to your email!" });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}