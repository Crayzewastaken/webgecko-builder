export const maxDuration = 300;

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

async function processWebsite(userInput: any) {
  try {
    console.log("STEP 1: Calling Claude...");

    let spec: any;
    try {
      const promptResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt" based on this brief: ${JSON.stringify(userInput)}`
        }]
      });
      const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
      console.log("STEP 1 DONE. Claude raw:", text.slice(0, 200));
      spec = extractJson(text);
      console.log("STEP 1 PARSED:", spec.projectTitle);
    } catch (e: any) {
      console.error("STEP 1 FAILED:", e.message);
      return;
    }

    console.log("STEP 2: Creating Stitch project...");
    let projectId: string;
    try {
      const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
      projectId = project?.name?.split("/")[1];
      console.log("STEP 2 DONE. projectId:", projectId);
    } catch (e: any) {
      console.error("STEP 2 FAILED:", e.message);
      return;
    }

    console.log("STEP 3: Generating Stitch screen...");
    let downloadUrl: string;
    try {
      const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
        projectId,
        prompt: spec.stitchPrompt,
      });
      const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
      console.log("STEP 3: screen count:", screens.length);
      if (!screens.length) throw new Error("No screens returned");
      downloadUrl = screens[0]?.htmlCode?.downloadUrl;
      if (!downloadUrl) throw new Error("No downloadUrl on screen");
      console.log("STEP 3 DONE. downloadUrl:", downloadUrl.slice(0, 80));
    } catch (e: any) {
      console.error("STEP 3 FAILED:", e.message);
      return;
    }

    console.log("STEP 4: Fetching HTML...");
    let html: string;
    try {
      html = await fetch(downloadUrl).then((r) => r.text());
      console.log("STEP 4 DONE. HTML length:", html.length);
    } catch (e: any) {
      console.error("STEP 4 FAILED:", e.message);
      return;
    }

    console.log("STEP 5: Sending email...");
    try {
      const result = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `Website - ${spec.projectTitle}`,
        html: "<p>Your website HTML is attached.</p>",
        attachments: [{ filename: "site.html", content: Buffer.from(html).toString("base64") }],
      });
      console.log("STEP 5 DONE. Resend result:", JSON.stringify(result));
    } catch (e: any) {
      console.error("STEP 5 FAILED:", e.message);
    }

  } catch (err: any) {
    console.error("GLOBAL ERROR:", err.message);
  }
}

export async function POST(req: Request) {
  const data = await req.json();
  console.log("REQUEST RECEIVED:", JSON.stringify(data).slice(0, 100));
  processWebsite(data);
  return NextResponse.json({ success: true, message: "Processing started. Check email in ~2 mins." });
}