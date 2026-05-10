// app/api/admin/content/generate/route.ts
// AI-generate content items (blog posts, newsletter copy, deal text, product descriptions, review replies)

import { NextRequest } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { type, businessName, industry, prompt, tone, existingContent } = body;
  if (!type || !businessName) return Response.json({ error: "type + businessName required" }, { status: 400 });

  const brandVoice = tone || "professional, friendly, and approachable";

  const prompts: Record<string, string> = {
    blog: `You are a professional content writer for ${businessName}, a ${industry || "local business"} in Australia.

Write a complete blog post with the following guidance: ${prompt || "Write an engaging, helpful blog post relevant to this business and its customers."}

Brand voice: ${brandVoice}

Return ONLY valid JSON in this exact format:
{
  "title": "Compelling blog post title",
  "slug": "url-friendly-slug",
  "metaDescription": "150-160 char SEO meta description",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "Full blog post in HTML (use h2, h3, p, ul, li tags). Minimum 400 words. No markdown. Real paragraphs with genuine value."
}`,

    newsletter: `You are a professional copywriter for ${businessName}, a ${industry || "local business"} in Australia.

Write a newsletter email with the following guidance: ${prompt || "Write an engaging newsletter update for customers — share news, tips, or a special offer."}

Brand voice: ${brandVoice}

Return ONLY valid JSON in this exact format:
{
  "subject": "Compelling email subject line (under 60 chars)",
  "title": "Newsletter headline",
  "body": "Full newsletter HTML body (use p, h2, ul, strong tags). 200-400 words. Warm, personal, valuable. No markdown."
}`,

    deal: `You are a marketing copywriter for ${businessName}, a ${industry || "local business"} in Australia.

Write promotional deal/offer copy with this guidance: ${prompt || "Write a compelling limited-time offer or promotion."}

Brand voice: ${brandVoice}

Return ONLY valid JSON in this exact format:
{
  "title": "Deal/promo headline (punchy, under 60 chars)",
  "body": "2-3 sentence deal description. Clear value, urgency, and call to action.",
  "discount": "e.g. 20% off, $50 off, Free consultation",
  "promoCode": "optional promo code or empty string"
}`,

    product: `You are a product copywriter for ${businessName}, a ${industry || "local business"} in Australia.

Write a product/service listing with this guidance: ${prompt || "Describe a key product or service offered by this business."}

Brand voice: ${brandVoice}

Return ONLY valid JSON in this exact format:
{
  "title": "Product/service name",
  "body": "Compelling product description (100-200 words). Focus on benefits, not just features. Conversational but professional.",
  "metaDescription": "Short one-liner for listing cards (under 80 chars)"
}`,

    review: `You are a customer relations manager for ${businessName}, a ${industry || "local business"} in Australia.

Write a professional response to a customer review with this guidance: ${prompt || "Write a warm, professional response to a positive customer review."}

Brand voice: ${brandVoice}

Return ONLY valid JSON in this exact format:
{
  "title": "Review summary (e.g. 'Thank you for your kind words!')",
  "body": "Professional, warm review response (2-3 sentences). Personal, grateful, not robotic."
}`,
  };

  const systemPrompt = prompts[type];
  if (!systemPrompt) return Response.json({ error: "Unknown content type" }, { status: 400 });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1800,
      messages: [{ role: "user", content: systemPrompt }],
    });

    const text = (msg.content[0] as any).text as string;
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ ok: true, generated: parsed });
  } catch (e: any) {
    console.error("[content/generate]", e.message);
    return Response.json({ error: "AI generation failed: " + e.message }, { status: 500 });
  }
}
