// lib/auditor.ts
// Brain 3: Claude Opus — Site Auditor
// Scans generated HTML for broken elements and fixes them in one pass.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface AuditResult {
  passed: boolean;
  issues: string[];
  fixedHtml: string;
}

export async function auditAndFixSite(
  html: string,
  context: {
    businessName: string;
    clientEmail: string;
    clientPhone: string;
    businessAddress?: string;
    hasBooking: boolean;
    isMultiPage: boolean;
    pages: string[];
    features: string[];
  }
): Promise<AuditResult> {
  const { businessName, clientEmail, clientPhone, businessAddress, hasBooking, isMultiPage, pages, features } = context;

  // Pre-audit checks (fast, no LLM needed)
  const issues: string[] = [];
  if (!html.includes(clientEmail)) issues.push(`Missing real email: ${clientEmail}`);
  if (clientPhone && !html.includes(clientPhone.replace(/\s/g, "")) && !html.includes(clientPhone)) issues.push(`Missing real phone: ${clientPhone}`);
  if (!html.includes('id="hamburger"')) issues.push('Missing hamburger menu id="hamburger"');
  if (!html.includes('id="contact"')) issues.push('Missing contact section id="contact"');
  if (!html.includes('id="faq"')) issues.push('Missing FAQ section id="faq"');
  if (!html.includes('id="testimonials"')) issues.push('Missing testimonials section id="testimonials"');
  if (hasBooking && !html.includes('id="booking"')) issues.push('Missing booking section id="booking"');
  if (isMultiPage && html.includes('href="#')) issues.push('Multi-page site has href="#" links instead of navigateTo()');
  if (html.includes("placeholder@") || html.includes("example.com") || html.includes("yourname@")) issues.push("Placeholder email found in HTML");
  if (html.includes("04XX") || html.includes("0400 000")) issues.push("Placeholder phone found in HTML");
  if (!html.includes("©") && !html.includes("&copy;")) issues.push("Missing copyright in footer");
  if (businessAddress && !html.includes(businessAddress.split(",")[0])) issues.push("Business address not found in HTML");

  // If no issues found, skip the LLM call entirely — saves cost + time
  if (issues.length === 0) {
    console.log("[Auditor] ✅ No issues found — skipping LLM fix pass");
    return { passed: true, issues: [], fixedHtml: html };
  }

  console.log(`[Auditor] Found ${issues.length} issues — running Claude Sonnet fix pass`);

  const fixResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: `You are a senior web developer auditing and fixing a generated website.

ISSUES TO FIX:
${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}

REQUIRED VALUES TO USE:
- Business Name: ${businessName}
- Email: ${clientEmail}
- Phone: ${clientPhone}
${businessAddress ? `- Address: ${businessAddress}` : ""}
${hasBooking ? `- Booking section MUST have id="booking"` : ""}
${isMultiPage ? `- This is a MULTI-PAGE site — nav links must use onclick="navigateTo('id')" NOT href="#id"` : ""}

RULES:
- Return the COMPLETE fixed HTML starting with <!DOCTYPE html>
- Fix ONLY the listed issues — do not change design, layout, colours, or copy
- Replace all placeholder emails with: ${clientEmail}
- Replace all placeholder phones with: ${clientPhone}
- Ensure id="hamburger" exists on the mobile menu button
- Ensure id="contact", id="faq", id="testimonials" exist on their sections
${hasBooking ? `- Ensure id="booking" exists on the booking section` : ""}
- Remove any href="javascript:void(0)" or dead links on nav items — wire them properly
- Ensure footer has copyright © ${new Date().getFullYear()} ${businessName}

HTML TO FIX:
${html}`,
    }],
  });

  const fixText = fixResponse.content[0]?.type === "text" ? fixResponse.content[0].text : html;
  // Extract clean HTML
  const start = fixText.indexOf("<!DOCTYPE");
  const fixedHtml = start !== -1 ? fixText.slice(start) : fixText;

  return {
    passed: false,
    issues,
    fixedHtml,
  };
}
