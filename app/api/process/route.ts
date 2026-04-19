export const maxDuration = 300;
export const runtime = "nodejs";

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function extractHtml(text: string) {
  const start = text.indexOf("<!DOCTYPE");
  if (start !== -1) return text.slice(start);
  const h = text.indexOf("<html");
  if (h !== -1) return text.slice(h);
  return text;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const secret = searchParams.get("secret");

    if (secret !== process.env.PROCESS_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!id) {
      return new Response("Missing id", { status: 400 });
    }

    console.log("PROCESS: Fetching from Redis, id:", id);
    const stored: any = await redis.get(id);

    if (!stored) {
      return new Response("Job not found or expired", { status: 404 });
    }

    const { html, title, fileName, userInput } = stored;
    const fixedFileName = `${fileName || 'website'}-fixed`;
    console.log("PROCESS: Got HTML, length:", html.length);

    console.log("PROCESS: Claude fixing interactions...");
    const fixResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `Add JavaScript interactions to this HTML.

RULES:
- Return COMPLETE HTML starting with <!DOCTYPE html>
- Do NOT change any design, CSS, colors, layout or text
- ONLY add a <script> block before </body> that handles:
  1. Hamburger button toggles mobile nav open/close
  2. Nav links smooth scroll to sections or switch pages using navigateTo()
  3. CTA buttons scroll to contact or relevant section
  4. Forms show success message on submit
  5. FAQ accordion using details/summary or div-based pattern
  6. Add id attributes to sections where missing

HTML:
${html}`
      }]
    });

    const fixText = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : html;
    const finalHtml = extractHtml(fixText);
    console.log("PROCESS: Fixed. Length:", finalHtml.length);

    const pageList = Array.isArray(userInput?.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";

    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `FIXED - ${title}`,
      html: `
        <h2>Fixed Website — ${title}</h2>
        <p><strong>Client:</strong> ${userInput?.name}</p>
        <p><strong>Email:</strong> ${userInput?.email}</p>
        <p><strong>Phone:</strong> ${userInput?.phone}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p>This version has working buttons, FAQ dropdowns and interactions.</p>
      `,
      attachments: [{
        filename: `${fixedFileName}.html`,
        content: Buffer.from(finalHtml).toString("base64"),
      }],
    });

    await redis.del(id);
    console.log("PROCESS: Done. Email sent.");

    return new Response(`
      <html>
        <body style="font-family:sans-serif;padding:40px;background:#0f172a;color:white;text-align:center;">
          <h1 style="color:#22c55e">✅ Done!</h1>
          <p>Fixed site <strong>${fixedFileName}.html</strong> has been sent to your email.</p>
          <p style="color:#94a3b8">You can close this tab.</p>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });

  } catch (error: any) {
    console.error("PROCESS FAILED:", error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}