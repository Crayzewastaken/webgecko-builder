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

    console.log("STEP 1: Calling Claude...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt". Brief: ${JSON.stringify(userInput)}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    console.log("STEP 1 DONE:", text.slice(0, 100));
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