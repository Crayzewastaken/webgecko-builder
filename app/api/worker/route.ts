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

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Claude returned invalid JSON");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    // STEP 1: Claude upgrades user request into advanced Stitch prompt
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

Generate the best advanced premium consulting website generation prompt.
          `,
        },
      ],
    });

    const promptText =
      promptResponse.content[0]?.type === "text"
        ? promptResponse.content[0].text
        : "{}";

    const spec = extractJson(promptText) as PromptSpec;

    // STEP 2: Stitch builds frontend
    const project = await stitchClient.callTool("create_project", {
      title: spec.projectTitle,
    });

    const projectId = project?.name?.split("/")[1];
    if (!projectId) {
      throw new Error("No projectId returned");
    }

    const stitchResult = await stitchClient.callTool(
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
      throw new Error("No screens returned from Stitch");
    }

    const firstScreen = screens[0];
    const downloadUrl = firstScreen?.htmlCode?.downloadUrl;

    if (!downloadUrl) {
      throw new Error("No Stitch html downloadUrl returned");
    }

    const stitchHtml = await fetch(downloadUrl).then((r) =>
      r.text()
    );

    // STEP 3: Claude backend compiler stage
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
- no markdown
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

    fs.writeFileSync(
      path.join(process.cwd(), "public", "generated-site.html"),
      finalHtml,
      "utf8"
    );

    return NextResponse.json({
      success: true,
      projectId,
      page: "/generated-site.html",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || String(error),
    });
  }
}