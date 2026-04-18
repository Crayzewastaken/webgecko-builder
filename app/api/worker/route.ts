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

function extractHtml(text: string) {
  const start = text.indexOf("<!DOCTYPE");
  if (start !== -1) return text.slice(start);
  const h = text.indexOf("<html");
  if (h !== -1) return text.slice(h);
  return text;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "<style>/* styles preserved */</style>")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList =
      Array.isArray(userInput.pages) && userInput.pages.length > 0
        ? userInput.pages.join(", ")
        : "Home";

    const isMultiPage = userInput.siteType === "multi";

    // STEP 1: Claude writes Stitch prompt
    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".

Brief: ${JSON.stringify(userInput)}
Pages: ${pageList}
Architecture: ${
            isMultiPage
              ? "Multi-page — separate navigable pages for: " + pageList
              : "Single page — scrollable sections for: " + pageList
          }
Goal: ${userInput.goal || "generate leads"}
Style: ${userInput.style || "modern premium"}
Features: ${
            Array.isArray(userInput.features)
              ? userInput.features.join(", ")
              : "contact form"
          }`,
        },
      ],
    });

    const text =
      promptResponse.content[0]?.type === "text"
        ? promptResponse.content[0].text
        : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    // STEP 2: Create Stitch project
    console.log("STEP 2: Creating project...");
    const project: any = await stitchClient.callTool("create_project", {
      title: spec.projectTitle,
    });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    // STEP 3: Generate screen
    console.log("STEP 3: Generating screen...");
    const stitchResult: any = await stitchClient.callTool(
      "generate_screen_from_text",
      {
        projectId,
        prompt: spec.stitchPrompt,
      }
    );

    const screens =
      stitchResult?.outputComponents?.find((x: any) => x.design)?.design
        ?.screens || [];
    if (!screens.length) throw new Error("No screens returned");
    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl");
    console.log("STEP 3 DONE");

    // STEP 4: Fetch HTML
    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Email raw HTML to you immediately
    console.log("STEP 5: Emailing raw site...");
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
        <p><strong>Features:</strong> ${
          Array.isArray(userInput.features)
            ? userInput.features.join(", ")
            : "-"
        }</p>
        <p><strong>Style:</strong> ${userInput.style}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
      `,
      attachments: [
        {
          filename: "site.html",
          content: Buffer.from(stitchHtml).toString("base64"),
        },
      ],
    });
    console.log("STEP 5 DONE");

    // STEP 6: If no JS, Claude adds interactions and sends updated version
    const hasJS =
      stitchHtml.includes("addEventListener") ||
      stitchHtml.includes("navigateTo");
    console.log("Has JS:", hasJS);

    if (!hasJS) {
      console.log("STEP 6: Claude adding interactions...");
      const stripped = stripHtml(stitchHtml);

      const fixResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: `Add JavaScript interactions to this HTML.

RULES:
- Return COMPLETE HTML starting with <!DOCTYPE html>
- Do NOT change any design, CSS, colors, layout or text
- ONLY add a <script> block before </body> that handles:
  1. Hamburger button toggles mobile nav open/close
  2. Nav links smooth scroll to matching section ids
  3. CTA buttons scroll to contact or relevant section
  4. Forms show a success message on submit
  5. Add id attributes to sections where missing

HTML:
${stripped}`,
          },
        ],
      });

      const fixText =
        fixResponse.content[0]?.type === "text"
          ? fixResponse.content[0].text
          : stitchHtml;
      const fixedHtml = extractHtml(fixText);
      console.log("STEP 6 DONE. Fixed length:", fixedHtml.length);

      // Send updated version
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `FIXED - ${spec.projectTitle}`,
        html: `<p>This is the interaction-fixed version of the site.</p>`,
        attachments: [
          {
            filename: "site-fixed.html",
            content: Buffer.from(fixedHtml).toString("base64"),
          },
        ],
      });
      console.log("STEP 6 EMAIL SENT");
    } else {
      console.log("STEP 6: Skipped — Stitch already has JS");
    }

    return NextResponse.json({
      success: true,
      message:
        "Thank you! We have received your request and will be in touch shortly.",
    });
  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}