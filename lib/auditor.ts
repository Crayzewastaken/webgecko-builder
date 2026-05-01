// lib/auditor.ts
// Brain 3: Site Auditor — surgical code-based fixes, no LLM rewrite.

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

  // 3. Missing hamburger id
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

  // 4. Contact section id — smart injection
  if (issues.some(i => i.includes('id="contact"'))) {
    const contactFallback = [
      '<section id="contact" style="padding:80px 24px;background:#0f172a;">',
      '<div style="max-width:640px;margin:0 auto;">',
      '<h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:8px;">Contact Us</h2>',
      '<p style="color:#94a3b8;margin-bottom:24px;">Get in touch and we\'ll respond within 24 hours.</p>',
      '<form style="display:flex;flex-direction:column;gap:16px;" onsubmit="event.preventDefault();this.innerHTML=\'<p style=&quot;color:#22c55e;font-weight:bold;&quot;>Thank you! We will be in touch shortly.</p>\'">',
      '<input type="text" placeholder="Your Name" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<input type="email" placeholder="Your Email" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<input type="tel" placeholder="Your Phone" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<textarea placeholder="Your Message" rows="5" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea>',
      '<button type="submit" style="background:#10b981;color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button>',
      '</form></div></section>',
    ].join("");
    fixed = addSectionIdSmart(fixed, "contact",
      [/contact|get-in-touch|contactus|reach-us/i],
      [/contact us|get in touch|reach us|enquire|send.*message|drop.*line|contact/i],
      contactFallback
    );
  }

  // 5. FAQ section id
  if (issues.some(i => i.includes('id="faq"'))) {
    fixed = addSectionIdSmart(fixed, "faq",
      [/faq|frequently|accordion|faqs/i],
      [/faq|frequently asked|common questions|questions\s*&\s*answers/i],
      '<section id="faq" style="padding:80px 24px;background:#080c14;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Frequently Asked Questions</h2></div></section>'
    );
  }

  // 6. Testimonials section id
  if (issues.some(i => i.includes('id="testimonials"'))) {
    fixed = addSectionIdSmart(fixed, "testimonials",
      [/testimonial|review|clients-say|client-say|feedback/i],
      [/testimonial|what.*client|what.*customer|what people say|our reviews|client review|customer review/i],
      '<section id="testimonials" style="padding:80px 24px;background:#0f172a;"><div style="max-width:900px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">What Our Clients Say</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;"><div style="background:#1e293b;border-radius:12px;padding:24px;"><p style="color:#e2e8f0;margin-bottom:16px;">"Absolutely fantastic service. Highly recommend!"</p><p style="color:#10b981;font-weight:700;">— Happy Client</p></div></div></div></section>'
    );
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
    fixed = addSectionIdSmart(fixed, "booking",
      [/booking|appointment|schedule|reserve/i],
      [/book|appointment|schedule|reserve/i],
      '<div id="booking"></div>'
    );
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

// Helper: add id to the first matching section (legacy — used for booking)
function addSectionId(html: string, id: string, patterns: RegExp[]): string {
  if (html.includes(`id="${id}"`)) return html;
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

// Smart helper: class-name match → heading-text scan → fallback section injection
function addSectionIdSmart(
  html: string,
  id: string,
  classPatterns: RegExp[],
  headingPatterns: RegExp[],
  fallbackSection: string
): string {
  if (html.includes(`id="${id}"`)) return html;

  // Strategy 1: class/id attribute on section/div contains keyword
  for (const cp of classPatterns) {
    let injected = false;
    const result = html.replace(
      /<(section|div)(\s[^>]*)?>(?=[^]*?id=)?/gi,
      (m: string) => {
        if (injected) return m;
        const classMatch = /class="([^"]*)"/.exec(m);
        const idMatch = /id="([^"]*)"/.exec(m);
        if (idMatch) return m; // already has id
        if (classMatch && cp.test(classMatch[1])) {
          injected = true;
          return m.replace(/>$/, ` id="${id}">`);
        }
        return m;
      }
    );
    if (injected) {
      console.log(`[Auditor] id="${id}" via class match`);
      return result;
    }
  }

  // Strategy 2: find a heading containing the keyword, walk back to find enclosing section/div
  for (const hp of headingPatterns) {
    const headingRe = new RegExp(`<h[1-4][^>]*>([^<]*)<\/h[1-4]>`, "gi");
    let headingMatch;
    let headingPos = -1;
    let headingText = "";
    headingRe.lastIndex = 0;
    while ((headingMatch = headingRe.exec(html)) !== null) {
      if (hp.test(headingMatch[1])) {
        headingPos = headingMatch.index;
        headingText = headingMatch[1].trim();
        break;
      }
    }
    if (headingPos === -1) continue;

    // Walk all opening tags before the heading, find the last one without id= within 8000 chars
    const openTagRe = /<(section|div)(\s[^>]*)?>/gi;
    let m2;
    let bestStart = -1;
    let bestStr = "";
    openTagRe.lastIndex = 0;
    while ((m2 = openTagRe.exec(html)) !== null) {
      if (m2.index >= headingPos) break;
      if (headingPos - m2.index < 8000 && !/id="/.test(m2[0])) {
        bestStart = m2.index;
        bestStr = m2[0];
      }
    }

    if (bestStart !== -1 && bestStr) {
      const withId = bestStr.replace(/>$/, ` id="${id}">`);
      const result = html.slice(0, bestStart) + withId + html.slice(bestStart + bestStr.length);
      console.log(`[Auditor] id="${id}" via heading scan ("${headingText}")`);
      return result;
    }
  }

  // Strategy 3: inject fallback section before </body>
  console.log(`[Auditor] id="${id}" via fallback injection`);
  return html.replace("</body>", fallbackSection + "\n</body>");
}
