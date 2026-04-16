export const maxDuration = 300;

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

type PromptSpec = {
  projectTitle: string;
  stitchPrompt: string;
};

function extractJson(text: string): PromptSpec {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Claude returned invalid JSON");
  }

  return JSON.parse(text.slice(start, end + 1));
}

async function processWebsite(userInput: any) {
  const promptResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2400,
    messages: [
      {
        role: "user",
        content: `
Return ONLY valid JSON:
{
  "projectTitle": "string",
  "stitchPrompt": "string"
}

You are generating a premium Stitch website architecture prompt.

CRITICAL WEBSITE STRUCTURE RULES:
- intelligently decide whether this should be:
  1) single page landing website
  2) multi-page business website
  3) ecommerce store
  4) portfolio/gallery site
  5) booking funnel
- use the client's requested pages and features
- if user requests pages like Shop, Gallery, About, Contact:
  create REAL separate pages
- if simple brochure site:
  use anchored single-page sections
- all navigation links must point to REAL existing destinations
- no dead links
- no fake pages
- preserve premium conversion UX

CRITICAL INTERACTION RULES:
- every navbar item must navigate to a real page OR real section
- mobile menu icon must open and close properly
- search icon must open visible search modal or search page
- hero CTA buttons must navigate to portfolio/listings/gallery/shop
- consultation buttons must navigate to contact form or booking page
- all forms must submit somewhere visible
- every visible CTA must have a real destination
- no dead buttons
- exported HTML must preserve button clickability

Transform this client brief into the best advanced premium website generation prompt for Stitch:

${JSON.stringify(userInput)}
        `,
      },
    ],
  });

  const promptText =
    promptResponse.content[0]?.type === "text"
      ? promptResponse.content[0].text
      : "{}";

  const spec = extractJson(promptText);

  const rawProject: any = await stitchClient.callTool("create_project", {
    title: spec.projectTitle,
  });

  const projectName: string = rawProject?.name || "";
  const projectId = projectName.split("/")[1];

  const rawStitchResult: any = await stitchClient.callTool(
    "generate_screen_from_text",
    {
      projectId,
      prompt: spec.stitchPrompt,
    }
  );

  const screens =
    rawStitchResult?.outputComponents?.find((x: any) => x.design)
      ?.design?.screens || [];

  if (!screens.length) {
    throw new Error("No screens returned from Stitch");
  }

  const firstScreen = screens[0];
  const downloadUrl = firstScreen?.htmlCode?.downloadUrl;

  if (!downloadUrl) {
    throw new Error("No Stitch html downloadUrl returned");
  }

  const stitchHtml = await fetch(downloadUrl).then((r) => r.text());

  await resend.emails.send({
    from: "AI Builder <onboarding@resend.dev>",
    to: process.env.RESULT_TO_EMAIL!,
    subject: `Generated Website - ${spec.projectTitle}`,
    html: `<p>Your generated website HTML is attached.</p>`,
    attachments: [
      {
        filename: `site-${Date.now()}.html`,
        content: Buffer.from(stitchHtml).toString("base64"),
      },
    ],
  });
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();

    processWebsite(userInput).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Website generation started. Check your email soon.",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || String(error),
    });
  }
}