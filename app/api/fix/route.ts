export const maxDuration = 60;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

function extractHtml(text: string) {
  const start = text.indexOf("<!DOCTYPE");
  if (start !== -1) return text.slice(start);
  const h = text.indexOf("<html");
  if (h !== -1) return text.slice(h);
  return text;
}

function compressHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

export async function POST(req: Request) {
  try {
    const { html, title, email } = await req.json();
    const compressed = compressHtml(html);

    const fixResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `Fix button interactions in this HTML.

RULES:
- Return COMPLETE HTML, do not truncate
- Do NOT change design, layout, CSS, colors or text
- ONLY add JavaScript for:
  1. Hamburger toggles mobile nav
  2. Nav links smooth scroll to section ids
  3. CTA buttons scroll to contact/relevant section
  4. Forms show success message on submit
  5. Add missing section ids where needed

Return complete HTML starting with <!DOCTYPE html>

HTML:
${compressed}`
      }]
    });

    const fixText = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : html;
    const finalHtml = extractHtml(fixText);

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Website - ${title}`,
      html: "<p>Your website is attached.</p>",
      attachments: [{ filename: "site.html", content: Buffer.from(finalHtml).toString("base64") }],
    });

    return NextResponse.json({ success: true, message: "Website sent to your email!" });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}