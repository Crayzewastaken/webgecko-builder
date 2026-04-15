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

function extractHtml(text: string) {
  const start = text.indexOf("<!DOCTYPE");
  if (start !== -1) return text.slice(start);

  const htmlStart = text.indexOf("<html");
  if (htmlStart !== -1) return text.slice(htmlStart);

  return text;
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();

    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `
Return ONLY valid JSON:
{
  "projectTitle": "string",
  "stitchPrompt": "string"
}

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

    const backendResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `
You are a production HTML compiler.

Take the following Stitch-generated HTML and return ONLY a final deployable HTML document.

CRITICAL RULES:
- output ONLY raw HTML
- must start with <!DOCTYPE html>
- preserve design exactly
- fix all navigation and buttons
- convert fake "live" features into REAL working fallbacks
- if "live rates" exists → convert to pricing modal/table
- if "live location" exists → convert to service coverage map/list
- if impossible real-time features exist → replace with CTA + quote form
- ensure every button opens something functional
- no dead buttons allowed
- forms must work
- no markdown
- no explanations

INPUT HTML:
${stitchHtml}
          `,
        },
      ],
    });

    const backendText =
      backendResponse.content[0]?.type === "text"
        ? backendResponse.content[0].text
        : stitchHtml;

    const finalHtml = extractHtml(backendText);

    const emailResult = await resend.emails.send({
      from: "AI Builder <onboarding@resend.dev>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Generated Website - ${spec.projectTitle}`,
      html: `<p>Your generated website HTML is attached.</p>`,
      attachments: [
        {
          filename: `site-${Date.now()}.html`,
          content: Buffer.from(finalHtml).toString("base64"),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      resendId: emailResult.data?.id,
      message: "Website sent to your email successfully",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || String(error),
    });
  }
}