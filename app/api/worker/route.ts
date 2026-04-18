export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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

    // STEP 1: Claude spec
    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".

Business: ${userInput.businessName}
Industry: ${userInput.industry}
USP: ${userInput.usp}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}

${isMultiPage ? `
MULTI-PAGE SITE REQUIRED.
Pages: ${pageList}
Build a multi-page website where each page (${pageList}) is a separate full section.
Navigation uses data-page attributes and JavaScript to switch between pages.
Each page hidden by default except Home which is active.
Every nav link must correspond to a real page.
` : `
SINGLE PAGE SITE REQUIRED.
Sections: ${pageList}
Build a single scrollable page with each section having its own id.
Navigation smooth scrolls to each section.
Hamburger menu on mobile.
`}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    // STEP 2: Create project
    console.log("STEP 2: Creating project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    // STEP 3: Generate screen
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

    // STEP 4: Fetch HTML
    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Save to Redis with 24hr expiry
    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, {
      html: stitchHtml,
      title: spec.projectTitle,
      userInput,
    }, { ex: 86400 });
    console.log("STEP 5: Saved to Redis. Job ID:", jobId);

    // STEP 6: Email you with fix button
    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/process?id=${jobId}&secret=${process.env.PROCESS_SECRET}`;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Request - ${spec.projectTitle}`,
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
        <br/>
        <p>The raw Stitch site is attached. Once you're ready to add working buttons and interactions, click below:</p>
        <br/>
        <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          ✅ Fix This Site
        </a>
        <br/><br/>
        <p style="color:#94a3b8;font-size:12px;">This link expires in 24 hours.</p>
      `,
      attachments: [{
        filename: "site-raw.html",
        content: Buffer.from(stitchHtml).toString("base64"),
      }],
    });
    console.log("STEP 6 DONE");

    return NextResponse.json({
      success: true,
      message: "Thank you! We have received your request and will be in touch shortly.",
    });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}