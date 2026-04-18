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
      ? userInput.pages.join(", ") : "Home";

    const isMultiPage = userInput.siteType === "multi";

    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".

You are generating a premium Stitch website prompt.

Brief: ${JSON.stringify(userInput)}
Pages needed: ${pageList}
Site architecture: ${isMultiPage ? "Multi-page — create separate navigable pages for: " + pageList : "Single page — scrollable sections for: " + pageList}
Goal: ${userInput.goal || "generate leads"}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}

CRITICAL RULES for the stitchPrompt:
- every nav link must work and go somewhere real
- hamburger must open mobile menu
- all CTA buttons must link to a real section or action
- forms must have visible submit behaviour
- no dead buttons
- no placeholder links`
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
    const finalHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", finalHtml.length);

    console.log("STEP 5: Sending email...");
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Website Request - ${spec.projectTitle}`,
      html: `
        <h2>New Website Request</h2>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Client:</strong> ${userInput.name}</p>
        <p><strong>Email:</strong> ${userInput.email}</p>
        <p><strong>Phone:</strong> ${userInput.phone}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Site Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</p>
        <p><strong>Style:</strong> ${userInput.style}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
      `,
      attachments: [{ filename: "site.html", content: Buffer.from(finalHtml).toString("base64") }],
    });
    console.log("STEP 5 DONE");

    return NextResponse.json({
      success: true,
      message: "Thank you! We have received your request and will be in touch shortly."
    });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}