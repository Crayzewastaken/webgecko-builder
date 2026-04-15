import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

Transform this user brief into the best advanced premium website generation prompt for Stitch:

${JSON.stringify(userInput)}
          `,
        },
      ],
    });

    const promptText =
      promptResponse.content[0]?.type === "text"
        ? promptResponse.content[0].text
        : "{}";

    const spec: PromptSpec = extractJson(promptText);

    // EXPLICIT TYPE FIX FOR VERCEL
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
- fix all internal navigation
- preserve design exactly
- keep buttons working
- fix forms
- normalize assets
- make deployable for hosting
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

    fs.writeFileSync(
      path.join(process.cwd(), "public", fileName),
      finalHtml,
      "utf8"
    );

    return NextResponse.json({
      success: true,
      page: `/${fileName}`,
      projectId,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || String(error),
    });
  }
}