export const maxDuration = 300;

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

async function processWebsite(userInput: any) {
  try {
    console.log("STEP 1: Starting Claude");

    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Return JSON with projectTitle and stitchPrompt from this:
${JSON.stringify(userInput)}`,
        },
      ],
    });

    const text =
      promptResponse.content[0]?.type === "text"
        ? promptResponse.content[0].text
        : "{}";

    const spec = extractJson(text);

    console.log("STEP 2: Creating Stitch project");

    const project: any = await stitchClient.callTool("create_project", {
      title: spec.projectTitle,
    });

    const projectId = project?.name?.split("/")[1];

    console.log("STEP 3: Generating screen");

    const stitchResult: any = await stitchClient.callTool(
      "generate_screen_from_text",
      {
        projectId,
        prompt: spec.stitchPrompt,
      }
    );

    const screens =
      stitchResult?.outputComponents?.find((x: any) => x.design)
        ?.design?.screens || [];

    if (!screens.length) {
      throw new Error("❌ No screens returned");
    }

    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;

    if (!downloadUrl) {
      throw new Error("❌ No download URL");
    }

    console.log("STEP 4: Fetching HTML");

    const html = await fetch(downloadUrl).then((r) => r.text());

    console.log("STEP 5: Sending email");

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: "Website Generated",
      html: "<p>Attached</p>",
      attachments: [
        {
          filename: "site.html",
          content: Buffer.from(html).toString("base64"),
        },
      ],
    });

    console.log("EMAIL RESULT:", result);

  } catch (err) {
    console.error("🔥 ERROR:", err);
  }
}

export async function POST(req: Request) {
  const data = await req.json();

  processWebsite(data); // no await

  return NextResponse.json({
    success: true,
    message: "Processing started",
  });
}