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

    if (!projectId) {
      throw new Error("No projectId returned");
    }

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
Take this Stitch frontend HTML and convert it into production-ready deployable static HTML.

Requirements:
- preserve design exactly
- fix navigation
- fix forms
- output ONLY full HTML

${stitchHtml}
          `,
        },
      ],
    });

    const finalHtml =
      backendResponse.content[0]?.type === "text"
        ? backendResponse.content[0].text
        : stitchHtml;

    const fileName = `site-${Date.now()}.html`;

    await resend.emails.send({
      from: "AI Builder <onboarding@resend.dev>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Generated Website - ${spec.projectTitle}`,
      html: `
        <h2>New Website Generated</h2>
        <p><strong>Business:</strong> ${userInput.businessName || spec.projectTitle}</p>
        <p>The generated website HTML is attached.</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(finalHtml).toString("base64"),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Website sent to your email successfully",
      projectId,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || String(error),
    });
  }
}