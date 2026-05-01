// lib/auditor.ts
// Brain 3: Site Auditor — surgical code-based fixes, no LLM rewrite.
// The previous LLM-based approach asked Claude to return the COMPLETE fixed HTML,
// which caused it to regenerate the entire page in its own style, destroying Stitch's design.
// This version fixes issues programmatically and only uses LLM for targeted snippets.

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
  const { businessName, clientEmail, clientPhone, businessAddress, hasBooking, isMultiPage } = context;

  // Pre-audit checks
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

  if (issues.length === 0) {
    console.log("[Auditor] No issues found — skipping fix pass");
    return { passed: true, issues: [], fixedHtml: html };
  }

  console.log(`[Auditor] Found ${issues.length} issues — applying surgical fixes (design preserved)`);

  // Surgical fixes — no LLM, preserves Stitch design
  let fixed = html;
  const currentYear = new Date().getFullYear();

  // 1. Placeholder emails → real email
  if (issues.some(i => i.includes("Placeholder email") || i.includes("Missing real email"))) {
    fixed = fixed.replace(/\b[\w.+-]+@(placeholder|example|company|business|yourcompany|yourbusiness|domain|email|test|sample|site|yourname)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
    fixed = fixed.replace(/\b(info|hello|contact|admin|support|enquiries|mail|office|reception)@[\w.-]+\.(com\.au|com|net\.au|net|org\.au|org|au)\b/gi, (m: string) => {
      if (m === clientEmail) return m;
      if (m.includes("webgecko") || m.includes("resend") || m.includes("anthropic")) return m;
      return clientEmail;
    });
  }

  // 2. Placeholder phones → real phone
  if (issues.some(i => i.includes("Placeholder phone") || i.includes("Missing real phone"))) {
    fixed = fixed.replace(/04XX[\s\d]*/g, clientPhone);
    fixed = fixed.replace(/0400\s?000\s?\d{3}/g, clientPhone);
    fixed = fixed.replace(/\b0[0-9]{3}\s?[0-9]{3}\s?[0-9]{3,4}\b/g, (m: string) => {
      const digits = m.replace(/\D/g, "");
      const realDigits = clientPhone.replace(/\D/g, "");
      if (digits === realDigits) return m;
      if (/0{4,}/.test(digits) || /(\d)\1{5,}/.test(digits) || digits === "0400000000" || digits === "0412345678") return clientPhone;
      return m;
    });
  }

  // 3. Missing hamburger id — find existing mobile menu button
  if (issues.some(i => i.includes("hamburger"))) {
    fixed = fixed.replace(
      /(<button[^>]*(?:class="[^"]*(?:hamburger|menu-toggle|nav-toggle|mobile-menu|menu-btn|sidebar-toggle)[^"]*"|aria-label="(?:Open menu|Menu|Toggle menu|Toggle navigation)")[^>]*)>/gi,
      (m: string, attrs: string) => {
        if (attrs.includes('id=')) return m;
        return `${attrs} id="hamburger">`;
      }
    );
    if (!fixed.includes('id="hamburger"')) {
      fixed = fixed.replace(/(<button[^>]*>)\s*(?:☰)/,
        (m: string, open: string) => {
          if (open.includes('id=')) return m;
          return open.replace('<button', '<button id="hamburger"') + '☰</button>';
        }
      );
    }
  }

  // 4–6. Missing section ids — add id to existing sections
  if (issues.some(i => i.includes('id="contact"'))) {
    fixed = addSectionId(fixed, "contact", [
      /(<(?:section|div)[^>]*class="[^"]*(?:contact|get-in-touch|reach-us|reach-out)[^"]*"[^>]*>)/gi,
      /(<(?:section|div)[^>]*>)(?=[\s\S]{0,600}?<h[1-4][^>]*>[^<]*(?:contact|get in touch|reach|enquir)[^<]*<\/h[1-4]>)/gi,
    ]);
  }
  if (issues.some(i => i.includes('id="faq"'))) {
    fixed = addSectionId(fixed, "faq", [
      /(<(?:section|div)[^>]*class="[^"]*(?:faq|frequently|accordion)[^"]*"[^>]*>)/gi,
      /(<(?:section|div)[^>]*>)(?=[\s\S]{0,600}?<h[1-4][^>]*>[^<]*(?:FAQ|frequently asked|questions)[^<]*<\/h[1-4]>)/gi,
    ]);
  }
  if (issues.some(i => i.includes('id="testimonials"'))) {
    fixed = addSectionId(fixed, "testimonials", [
      /(<(?:section|div)[^>]*class="[^"]*(?:testimonial|review|client|feedback)[^"]*"[^>]*>)/gi,
      /(<(?:section|div)[^>]*>)(?=[\s\S]{0,600}?<h[1-4][^>]*>[^<]*(?:testimonial|review|what.*say|our client)[^<]*<\/h[1-4]>)/gi,
    ]);
  }

  // 7. Missing copyright — inject into footer
  if (issues.some(i => i.includes("copyright"))) {
    if (fixed.includes("</footer>")) {
      fixed = fixed.replace(/([\s\S]*?)(<\/footer>)/i, (m: string, body: string, close: string) => {
        if (body.includes("©") || body.includes("&copy;")) return m;
        return body + `\n<div style="text-align:center;padding:12px 0;"><span style="font-size:13px;opacity:0.7;">© ${currentYear} ${businessName}. All rights reserved.</span></div>\n` + close;
      });
    } else {
      fixed = fixed.replace("</body>", `<div style="text-align:center;padding:20px;font-size:13px;opacity:0.6;">© ${currentYear} ${businessName}. All rights reserved.</div>\n</body>`);
    }
  }

  // 8. Missing booking id
  if (hasBooking && issues.some(i => i.includes('id="booking"'))) {
    fixed = addSectionId(fixed, "booking", [
      /(<(?:section|div)[^>]*class="[^"]*(?:booking|appointment|schedule|reserve)[^"]*"[^>]*>)/gi,
      /(<(?:section|div)[^>]*>)(?=[\s\S]{0,600}?<h[1-4][^>]*>[^<]*(?:book|appointment|schedule|reserve)[^<]*<\/h[1-4]>)/gi,
    ]);
    if (!fixed.includes('id="booking"')) {
      fixed = fixed.replace("</body>", `<div id="booking"></div>\n</body>`);
    }
  }

  // 9. Multi-page href="#" → navigateTo
  if (isMultiPage && issues.some(i => i.includes('href="#"'))) {
    const pageMap: Record<string, string> = { home: "home", about: "about", services: "services", contact: "contact", faq: "faq", gallery: "gallery", pricing: "pricing", shop: "shop", blog: "blog" };
    fixed = fixed.replace(/<a([^>]*)href="#"([^>]*)>([\s\S]*?)<\/a>/g, (m: string, before: string, after: string, inner: string) => {
      if (before.includes("onclick") || after.includes("onclick")) return m;
      const text = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
      const target = Object.entries(pageMap).find(([k]) => text.includes(k))?.[1] || "home";
      return `<a${before}href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${target}')"${after}>${inner}</a>`;
    });
  }

  console.log("[Auditor] Surgical fixes complete — Stitch design preserved");
  return { passed: false, issues, fixedHtml: fixed };
}

// Helper: add id to the first matching section that doesn't already have the target id
function addSectionId(html: string, id: string, patterns: RegExp[]): string {
  if (html.includes(`id="${id}"`)) return html; // already present
  for (const pattern of patterns) {
    const result = html.replace(pattern, (m: string, tag: string) => {
      if (!tag || tag.includes(`id="`)) return m;
      const withId = tag.replace(/>$/, ` id="${id}">`);
      return withId + m.slice(tag.length);
    });
    if (result !== html) return result;
  }
  return html;
}
