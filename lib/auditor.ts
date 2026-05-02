// lib/auditor.ts
// Brain 3: Site Auditor — surgical fixes, typed error taxonomy.

export enum AuditErrorType {
  PLACEHOLDER_EMAIL    = "PLACEHOLDER_EMAIL",
  PLACEHOLDER_PHONE    = "PLACEHOLDER_PHONE",
  MISSING_HAMBURGER    = "MISSING_HAMBURGER",
  MISSING_CONTACT      = "MISSING_CONTACT",
  MISSING_FAQ          = "MISSING_FAQ",
  MISSING_TESTIMONIALS = "MISSING_TESTIMONIALS",
  MISSING_BOOKING      = "MISSING_BOOKING",
  MISSING_COPYRIGHT    = "MISSING_COPYRIGHT",
  MISSING_ADDRESS      = "MISSING_ADDRESS",
  BROKEN_NAV_LINKS     = "BROKEN_NAV_LINKS",
}

export const ERROR_FIXES: Record<AuditErrorType, string> = {
  [AuditErrorType.PLACEHOLDER_EMAIL]:    "Replace placeholder emails with real client email",
  [AuditErrorType.PLACEHOLDER_PHONE]:    "Replace placeholder phones with real client phone",
  [AuditErrorType.MISSING_HAMBURGER]:    "Add id=hamburger to mobile menu button",
  [AuditErrorType.MISSING_CONTACT]:      "Inject contact section with id=contact",
  [AuditErrorType.MISSING_FAQ]:          "Inject FAQ section with id=faq",
  [AuditErrorType.MISSING_TESTIMONIALS]: "Inject testimonials section with id=testimonials",
  [AuditErrorType.MISSING_BOOKING]:      "Inject booking placeholder div with id=booking",
  [AuditErrorType.MISSING_COPYRIGHT]:    "Inject copyright line into footer",
  [AuditErrorType.MISSING_ADDRESS]:      "Address check only — no auto-fix",
  [AuditErrorType.BROKEN_NAV_LINKS]:     "Replace href=# links with navigateTo() calls",
};

export interface AuditIssue {
  type: AuditErrorType;
  detail: string;
  fixed: boolean;
}

export interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  issueStrings: string[];
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
  const issues: AuditIssue[] = [];
  const add = (type: AuditErrorType, detail: string) => issues.push({ type, detail, fixed: false });
  const has = (t: AuditErrorType) => issues.some(i => i.type === t);
  const mark = (t: AuditErrorType) => issues.filter(i => i.type === t).forEach(i => { i.fixed = true; });

  if (!html.includes(clientEmail)) add(AuditErrorType.PLACEHOLDER_EMAIL, "Missing real email: " + clientEmail);
  if (clientPhone && !html.includes(clientPhone.replace(/\s/g, "")) && !html.includes(clientPhone)) add(AuditErrorType.PLACEHOLDER_PHONE, "Missing real phone: " + clientPhone);
  if (!html.includes('id="hamburger"')) add(AuditErrorType.MISSING_HAMBURGER, 'Missing id="hamburger"');
  if (!html.includes('id="contact"'))   add(AuditErrorType.MISSING_CONTACT,   'Missing id="contact"');
  if (!html.includes('id="faq"'))        add(AuditErrorType.MISSING_FAQ,       'Missing id="faq"');
  if (!html.includes('id="testimonials"')) add(AuditErrorType.MISSING_TESTIMONIALS, 'Missing id="testimonials"');
  if (hasBooking && !html.includes('id="booking"')) add(AuditErrorType.MISSING_BOOKING, 'Missing id="booking"');
  if (isMultiPage && html.includes('href="#')) add(AuditErrorType.BROKEN_NAV_LINKS, "Multi-page href=# links");
  if (html.includes("placeholder@") || html.includes("example.com") || html.includes("yourname@")) add(AuditErrorType.PLACEHOLDER_EMAIL, "Placeholder email found");
  if (html.includes("04XX") || html.includes("0400 000")) add(AuditErrorType.PLACEHOLDER_PHONE, "Placeholder phone found");
  if (!html.includes("©") && !html.includes("&copy;")) add(AuditErrorType.MISSING_COPYRIGHT, "Missing copyright in footer");
  if (businessAddress && !html.includes(businessAddress.split(",")[0])) add(AuditErrorType.MISSING_ADDRESS, "Business address not found");

  if (issues.length === 0) {
    console.log("[Auditor] No issues found");
    return { passed: true, issues: [], issueStrings: [], fixedHtml: html };
  }

  issues.forEach(i => console.log("  [Auditor][" + i.type + "] " + i.detail + " => " + ERROR_FIXES[i.type]));
  let fixed = html;
  const yr = new Date().getFullYear();

  // Fix 1: emails
  if (has(AuditErrorType.PLACEHOLDER_EMAIL)) {
    fixed = fixed.replace(/\b[\w.+-]+@(placeholder|example|company|business|yourcompany|yourbusiness|domain|email|test|sample|site|yourname)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
    fixed = fixed.replace(/\b(info|hello|contact|admin|support|enquiries|mail|office|reception)@[\w.-]+\.(com\.au|com|net\.au|net|org\.au|org|au)\b/gi, (m: string) => {
      if (m === clientEmail || m.includes("webgecko") || m.includes("resend") || m.includes("anthropic")) return m;
      return clientEmail;
    });
    mark(AuditErrorType.PLACEHOLDER_EMAIL);
  }

  // Fix 2: phones
  if (has(AuditErrorType.PLACEHOLDER_PHONE)) {
    fixed = fixed.replace(/04XX[\s\d]*/g, clientPhone);
    fixed = fixed.replace(/0400\s?000\s?\d{3}/g, clientPhone);
    fixed = fixed.replace(/\b0[0-9]{3}\s?[0-9]{3}\s?[0-9]{3,4}\b/g, (m: string) => {
      const d = m.replace(/\D/g, ""), r = clientPhone.replace(/\D/g, "");
      if (d === r) return m;
      if (/0{4,}/.test(d) || /(\d)\1{5,}/.test(d) || d === "0400000000" || d === "0412345678") return clientPhone;
      return m;
    });
    mark(AuditErrorType.PLACEHOLDER_PHONE);
  }

  // Fix 3: hamburger
  if (has(AuditErrorType.MISSING_HAMBURGER)) {
    fixed = fixed.replace(/(<button[^>]*(?:class="[^"]*(?:hamburger|menu-toggle|nav-toggle|mobile-menu|menu-btn)[^"]*"|aria-label="(?:Open menu|Menu|Toggle menu|Toggle navigation)")[^>]*)>/gi,
      (m: string, attrs: string) => attrs.includes('id=') ? m : attrs + ' id="hamburger">'
    );
    mark(AuditErrorType.MISSING_HAMBURGER);
  }

  // Fix 4: contact section
  if (has(AuditErrorType.MISSING_CONTACT)) {
    const onsubmit = "event.preventDefault();this.innerHTML='<p style=\"color:#22c55e;font-weight:bold;\">Thank you!</p>'";
    const fb = [
      '<section id="contact" style="padding:80px 24px;background:#0f172a;">',
      '<div style="max-width:640px;margin:0 auto;">',
      '<h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:8px;">Contact Us</h2>',
      '<p style="color:#94a3b8;margin-bottom:24px;">Get in touch and we will respond within 24 hours.</p>',
      "<form style=\"display:flex;flex-direction:column;gap:16px;\" onsubmit=\"" + onsubmit + "\">",
      '<input type="text" placeholder="Your Name" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<input type="email" placeholder="Your Email" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<input type="tel" placeholder="Your Phone" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>',
      '<textarea placeholder="Your Message" rows="5" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea>',
      '<button type="submit" style="background:#10b981;color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button>',
      '</form></div></section>',
    ].join("");
    fixed = addSectionIdSmart(fixed, "contact", [/contact|get-in-touch|contactus|reach-us/i], [/contact us|get in touch|reach us|enquire|send.*message/i], fb);
    mark(AuditErrorType.MISSING_CONTACT);
  }

  // Fix 5: FAQ
  if (has(AuditErrorType.MISSING_FAQ)) {
    fixed = addSectionIdSmart(fixed, "faq", [/faq|frequently|accordion|faqs/i], [/faq|frequently asked|common questions/i],
      '<section id="faq" style="padding:80px 24px;background:#080c14;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Frequently Asked Questions</h2></div></section>'
    );
    mark(AuditErrorType.MISSING_FAQ);
  }

  // Fix 6: testimonials
  if (has(AuditErrorType.MISSING_TESTIMONIALS)) {
    fixed = addSectionIdSmart(fixed, "testimonials", [/testimonial|review|clients-say|feedback/i], [/testimonial|what.*client|what.*customer|what people say/i],
      '<section id="testimonials" style="padding:80px 24px;background:#0f172a;"><div style="max-width:900px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">What Our Clients Say</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;"><div style="background:#1e293b;border-radius:12px;padding:24px;"><p style="color:#e2e8f0;margin-bottom:16px;">Absolutely fantastic service. Highly recommend!</p><p style="color:#10b981;font-weight:700;">— Happy Client</p></div></div></div></section>'
    );
    mark(AuditErrorType.MISSING_TESTIMONIALS);
  }

  // Fix 7: copyright
  if (has(AuditErrorType.MISSING_COPYRIGHT)) {
    if (fixed.includes("</footer>")) {
      fixed = fixed.replace(/([\s\S]*?)(<\/footer>)/i, (m: string, body: string, close: string) => {
        if (body.includes("©") || body.includes("&copy;")) return m;
        return body + '\n<div style="text-align:center;padding:12px 0;font-size:13px;opacity:0.7;">© ' + yr + ' ' + businessName + '</div>\n' + close;
      });
    } else {
      fixed = fixed.replace("</body>", '<div style="text-align:center;padding:20px;font-size:13px;opacity:0.6;">© ' + yr + ' ' + businessName + '</div>\n</body>');
    }
    mark(AuditErrorType.MISSING_COPYRIGHT);
  }

  // Fix 8: booking placeholder (step6c replaces with real component)
  if (hasBooking && has(AuditErrorType.MISSING_BOOKING)) {
    fixed = addSectionIdSmart(fixed, "booking", [/booking|appointment|schedule|reserve/i], [/book|appointment|schedule|reserve/i], '<div id="booking"></div>');
    mark(AuditErrorType.MISSING_BOOKING);
  }

  // Fix 9: multi-page broken nav links
  if (isMultiPage && has(AuditErrorType.BROKEN_NAV_LINKS)) {
    const pageMap: Record<string,string> = { home:"home",about:"about",services:"services",contact:"contact",faq:"faq",gallery:"gallery",pricing:"pricing",shop:"shop",blog:"blog" };
    fixed = fixed.replace(/<a([^>]*)href="#"([^>]*)>([\s\S]*?)<\/a>/g, (m: string, before: string, after: string, inner: string) => {
      if (before.includes("onclick") || after.includes("onclick")) return m;
      const text = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
      const target = Object.entries(pageMap).find(([k]) => text.includes(k))?.[1] || "home";
      return "<a" + before + 'href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo(\'' + target + '\')"'  + after + ">" + inner + "</a>";
    });
    mark(AuditErrorType.BROKEN_NAV_LINKS);
  }

  const issueStrings = issues.map(i => i.detail);
  console.log("[Auditor] Fixed " + issues.filter(i => i.fixed).length + "/" + issues.length + " issues");
  return { passed: false, issues, issueStrings, fixedHtml: fixed };
}

function addSectionIdSmart(html: string, id: string, classPatterns: RegExp[], headingPatterns: RegExp[], fallbackSection: string): string {
  if (html.includes('id="' + id + '"')) return html;
  for (const cp of classPatterns) {
    let injected = false;
    const result = html.replace(/<(section|div)(\s[^>]*)?>(?=[^]*?id=)?/gi, (m: string) => {
      if (injected) return m;
      const cm = /class="([^"]*)"/.exec(m), im = /id="([^"]*)"/.exec(m);
      if (im) return m;
      if (cm && cp.test(cm[1])) { injected = true; return m.replace(/>$/, ' id="' + id + '">'); }
      return m;
    });
    if (injected) { console.log('[Auditor] id="' + id + '" via class match'); return result; }
  }
  for (const hp of headingPatterns) {
    const re = new RegExp("<h[1-4][^>]*>([^<]*)<\/h[1-4]>", "gi");
    let hm; let pos = -1; let ht = "";
    re.lastIndex = 0;
    while ((hm = re.exec(html)) !== null) { if (hp.test(hm[1])) { pos = hm.index; ht = hm[1].trim(); break; } }
    if (pos === -1) continue;
    const tagRe = new RegExp("<(section|div)(\\s[^>]*)?>", "gi");
    let tm; let bStart = -1; let bStr = "";
    tagRe.lastIndex = 0;
    while ((tm = tagRe.exec(html)) !== null) {
      if (tm.index >= pos) break;
      if (pos - tm.index < 8000 && !/id="/.test(tm[0])) { bStart = tm.index; bStr = tm[0]; }
    }
    if (bStart !== -1 && bStr) {
      console.log('[Auditor] id="' + id + '" via heading scan ("' + ht + '")');
      return html.slice(0, bStart) + bStr.replace(/>$/, ' id="' + id + '">') + html.slice(bStart + bStr.length);
    }
  }
  console.log('[Auditor] id="' + id + '" via fallback injection');
  return html.replace("</body>", fallbackSection + "\n</body>");
}
