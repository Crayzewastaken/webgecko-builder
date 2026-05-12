// lib/auditor.ts
// Brain 3: Site Auditor — surgical fixes, typed error taxonomy.
import { normalizePageId } from "@/lib/pipeline-helpers";

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


function detectTheme(html: string): "light" | "dark" {
  const head = html.slice(0, 4000);
  // Explicit dark class
  if (/class="[^"]*dark/.test(head)) return "dark";
  // Tailwind light backgrounds
  if (/bg-white|bg-zinc-50|bg-gray-50|bg-slate-50/i.test(head)) return "light";
  // Inline light background colors
  if (/background(?:-color)?:\s*(?:#fff|#ffffff|white|#f[89a-f]f[89a-f]f[89a-f])/i.test(head)) return "light";
  // Dark background colors
  if (/background(?:-color)?:\s*(?:#0[a-f0-9]{5}|#1[a-f0-9]{5}|#0f172a|#0a0f1a|#111|#000)/i.test(head)) return "dark";
  // Body background
  if (/body[^{]*\{[^}]*background[^}]*(?:#fff|white|#f[89a-f])/i.test(head)) return "light";
  return "dark";
}

export async function auditAndFixSite(
  html: string,
  context: {
    businessName: string;
    industry?: string;
    clientEmail: string;
    clientPhone: string;
    businessAddress?: string;
    abn?: string;
    domain?: string;
    hasBooking: boolean;
    isMultiPage: boolean;
    pages: string[];
    features: string[];
  }
): Promise<AuditResult> {
  const { businessName, industry = "", clientEmail, clientPhone, businessAddress, abn = "", domain = "", hasBooking, isMultiPage } = context;
  const issues: AuditIssue[] = [];
  const add = (type: AuditErrorType, detail: string) => issues.push({ type, detail, fixed: false });
  const has = (t: AuditErrorType) => issues.some(i => i.type === t);
  const mark = (t: AuditErrorType) => issues.filter(i => i.type === t).forEach(i => { i.fixed = true; });

  if (!html.includes(clientEmail)) add(AuditErrorType.PLACEHOLDER_EMAIL, "Missing real email: " + clientEmail);
  if (clientPhone && !html.includes(clientPhone.replace(/\s/g, "")) && !html.includes(clientPhone)) add(AuditErrorType.PLACEHOLDER_PHONE, "Missing real phone: " + clientPhone);
  const hasHamburger = html.includes('id="hamburger"') || /data-icon=["']menu["']/.test(html) || /aria-label=["'](?:open menu|menu|toggle)["']/i.test(html);
  if (!hasHamburger) add(AuditErrorType.MISSING_HAMBURGER, 'Missing id="hamburger"');
  // For multi-page sites: check required content inside the correct page wrappers,
  // NOT just whether 2+ data-page wrappers exist. The old isValidMultiPage shortcut
  // caused missing contact/FAQ/testimonials to go unfixed when wrapper count was ≥ 2.
  const requestedPageIds = context.pages.map((p: string) => normalizePageId(p));

  if (isMultiPage) {
    // contact: id="contact" must exist somewhere, or the contact page must have a form
    const hasContactId = html.includes('id="contact"');
    const contactPageHasForm = requestedPageIds.includes("contact")
      && html.includes('data-page="contact"')
      && /<form[\s>]/i.test(html.slice(html.indexOf('data-page="contact"'), html.indexOf('data-page="contact"') + 8000));
    if (!hasContactId && !contactPageHasForm) add(AuditErrorType.MISSING_CONTACT, 'Multi-page: id="contact" missing and no form in contact page');

    // faq: id="faq" must exist, or the faq page must have FAQ content
    const hasFaqId = html.includes('id="faq"');
    const faqPageHasContent = requestedPageIds.includes("faq")
      && html.includes('data-page="faq"')
      && (html.slice(html.indexOf('data-page="faq"'), html.indexOf('data-page="faq"') + 4000).length > 400);
    if (!hasFaqId && !faqPageHasContent) add(AuditErrorType.MISSING_FAQ, 'Multi-page: id="faq" missing');

    // testimonials: id="testimonials" must exist, or testimonial content exists somewhere
    const hasTestimonialsId = html.includes('id="testimonials"');
    const hasTestimonialContent = /testimonial|what.*client.*say|what.*customer/i.test(html);
    if (!hasTestimonialsId && !hasTestimonialContent) add(AuditErrorType.MISSING_TESTIMONIALS, 'Multi-page: id="testimonials" missing and no testimonial content found');
  } else {
    // Single-page: all content must be present as top-level sections
    if (!html.includes('id="contact"'))      add(AuditErrorType.MISSING_CONTACT,      'Missing id="contact"');
    if (!html.includes('id="faq"'))           add(AuditErrorType.MISSING_FAQ,          'Missing id="faq"');
    if (!html.includes('id="testimonials"'))  add(AuditErrorType.MISSING_TESTIMONIALS, 'Missing id="testimonials"');
  }

  if (hasBooking && !html.includes('id="booking"')) add(AuditErrorType.MISSING_BOOKING, 'Missing id="booking"');
  if (isMultiPage && html.includes('href="#')) {
    const navTargets = [...html.matchAll(/navigateTo\(['"]([^'"]+)['"]/g)].map(m => m[1]);
    const hasOrphans = navTargets.some(t =>
      !new RegExp(`\\bid=["']${t}["']`).test(html) &&
      !new RegExp(`\\bdata-page=["']${t}["']`).test(html)
    );
    if (hasOrphans || navTargets.length === 0) add(AuditErrorType.BROKEN_NAV_LINKS, "Multi-page href=# links with missing targets");
  }
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
  const dark = detectTheme(html) === "dark";
  const clrBg   = dark ? "#0f172a" : "#f8fafc";
  const clrBg2  = dark ? "#080c14" : "#f1f5f9";
  const clrCard = dark ? "#1e293b" : "#ffffff";
  const clrText = dark ? "#e2e8f0" : "#0f172a";
  const clrSub  = dark ? "#94a3b8" : "#475569";
  const clrBord = dark ? "#334155" : "#e2e8f0";
  const clrInp  = dark ? "#1e293b" : "#ffffff";
  const clrAcct = dark ? "#10b981" : "#059669";

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

  // Fix 3: hamburger — try multiple strategies to wire a hamburger button
  if (has(AuditErrorType.MISSING_HAMBURGER)) {
    // Strategy A: add id="hamburger" to any button with known hamburger class/aria
    let hamburgerFixed = fixed.replace(/(<button[^>]*(?:class="[^"]*(?:hamburger|menu-toggle|nav-toggle|mobile-menu|menu-btn)[^"]*"|aria-label="(?:Open menu|Menu|Toggle menu|Toggle navigation)")[^>]*)>/gi,
      (m: string, attrs: string) => attrs.includes('id=') ? m : attrs + ' id="hamburger">'
    );
    // Strategy B: find button containing data-icon="menu" span — add id="hamburger" to the button
    if (hamburgerFixed === fixed) {
      hamburgerFixed = fixed.replace(/(<button(?:[^>]*)>)(\s*<[^>]*data-icon=["']menu["'][^>]*>)/gi,
        (m: string, btnOpen: string, iconSpan: string) => {
          if (btnOpen.includes('id=')) return m;
          return btnOpen.replace('<button', '<button id="hamburger"') + iconSpan;
        }
      );
    }
    // Strategy C: find md:hidden button (Tailwind pattern) and add id
    if (hamburgerFixed === fixed) {
      hamburgerFixed = fixed.replace(/(<button[^>]*class="[^"]*md:hidden[^"]*"[^>]*)>/gi,
        (m: string, attrs: string) => attrs.includes('id=') ? m : attrs + ' id="hamburger">'
      );
    }
    fixed = hamburgerFixed;
    mark(AuditErrorType.MISSING_HAMBURGER);
  }

  // Fix 3b: ensure required semantic IDs exist (hero, testimonials, faq) regardless of multi-page
  // These are checked by the smoke test and checklist — add them if content exists but id is missing
  const semanticIds: Array<{ id: string; patterns: RegExp[] }> = [
    { id: "hero", patterns: [/class="[^"]*hero/i, /full.{0,10}viewport|min-height:\s*100vh|100vmin/i] },
    { id: "testimonials", patterns: [/class="[^"]*(?:testimonial|review)/i, /what.*(?:client|customer).*say|our.*review/i] },
    { id: "faq", patterns: [/class="[^"]*(?:faq|accordion)/i, /frequently.asked|common.question/i] },
  ];
  for (const { id, patterns } of semanticIds) {
    if (fixed.includes(`id="${id}"`)) continue; // already present
    for (const pat of patterns) {
      // Find a section/div matching pattern, add id if it lacks one
      let added = false;
      fixed = fixed.replace(/<(section|div)(\s[^>]*)?>(?=[\s\S]{0,200}(?:class|style))/gi, (m: string) => {
        if (added) return m;
        if (!pat.test(m)) return m;
        if (/\bid=/.test(m)) return m;
        added = true;
        console.log(`[Auditor] added id="${id}" via pattern match`);
        return m.replace(/>$/, ` id="${id}">`);
      });
      if (added) break;
    }
  }

  // Fix 4: contact section
  if (has(AuditErrorType.MISSING_CONTACT)) {
    const onsubmit = "event.preventDefault();this.innerHTML='<p style=\"color:#22c55e;font-weight:bold;\">Thank you!</p>'";
    const fb = [
      `<section id="contact" style="padding:80px 24px;background:${clrBg};">`,
      `<div style="max-width:640px;margin:0 auto;">`,
      `<h2 style="color:${clrText};font-size:2rem;font-weight:900;margin-bottom:8px;">Contact Us</h2>`,
      `<p style="color:${clrSub};margin-bottom:24px;">Get in touch and we will respond within 24 hours.</p>`,
      `<form style="display:flex;flex-direction:column;gap:16px;" onsubmit="${onsubmit}">`,
      `<input type="text" placeholder="Your Name" required style="background:${clrInp};color:${clrText};border:1px solid ${clrBord};border-radius:8px;padding:14px;font-size:1rem;"/>`,
      `<input type="email" placeholder="Your Email" required style="background:${clrInp};color:${clrText};border:1px solid ${clrBord};border-radius:8px;padding:14px;font-size:1rem;"/>`,
      `<input type="tel" placeholder="Your Phone" style="background:${clrInp};color:${clrText};border:1px solid ${clrBord};border-radius:8px;padding:14px;font-size:1rem;"/>`,
      `<textarea placeholder="Your Message" rows="5" style="background:${clrInp};color:${clrText};border:1px solid ${clrBord};border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea>`,
      `<button type="submit" style="background:${clrAcct};color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button>`,
      '</form></div></section>',
    ].join("");
    fixed = addSectionIdSmart(fixed, "contact", [/contact|get-in-touch|contactus|reach-us/i], [/contact us|get in touch|reach us|enquire|send.*message/i], fb);
    mark(AuditErrorType.MISSING_CONTACT);
  }

  // Fix 5: FAQ — inject real accordion items relevant to the business
  if (has(AuditErrorType.MISSING_FAQ)) {
    const faqItems: [string,string][] = (() => {
      const ind = industry.toLowerCase();
      if (/dentist|dental|orthodont/i.test(ind)) return [
        ["Do you accept new patients?", "Yes, we're currently welcoming new patients. Simply call us or book online to arrange your first visit."],
        ["What payment options do you accept?", "We accept cash, EFTPOS, credit cards, and process most major health fund claims on the spot."],
        ["How often should I have a dental check-up?", "We recommend a check-up and clean every six months to maintain good oral health."],
        ["Do you offer payment plans?", "Yes, we offer interest-free payment plans. Ask our reception team for details."],
        ["Is there parking available?", "Yes, there is convenient parking directly outside our clinic."],
        ["What do I do in a dental emergency?", "Call us immediately — we keep emergency appointments available each day for urgent dental care."],
      ];
      if (/doctor|medical|gp|health|clinic|physio|chiro/i.test(ind)) return [
        ["Do I need a referral to book an appointment?", "No referral is needed for a GP visit. Specialist referrals are arranged by your GP if required."],
        ["How do I book an appointment?", "You can book online 24/7 or call our reception during business hours."],
        ["Do you bulk bill?", "Bulk billing is available for eligible patients including concession card holders and children. Ask our team for details."],
        ["What should I bring to my first appointment?", "Please bring your Medicare card, any existing referrals, a list of current medications, and your health fund card if applicable."],
        ["Do you offer telehealth appointments?", "Yes, telehealth appointments are available for suitable consultations. Book online and select telehealth."],
        ["What are your opening hours?", "We're open Monday to Friday and offer Saturday morning appointments. Check our Contact page for full hours."],
      ];
      if (/plumb|electr|hvac|build|construct|trade|roof|paint/i.test(ind)) return [
        ["Are you licensed and insured?", "Yes, we are fully licensed, insured, and compliant with all Australian standards."],
        ["Do you provide free quotes?", "Yes, we offer free, no-obligation quotes. Contact us to arrange a time."],
        ["How quickly can you attend an emergency?", "We offer same-day emergency callouts. Call us directly for urgent jobs."],
        ["Do you service my area?", "We service the local area and surrounding suburbs. Contact us to confirm availability in your location."],
        ["What payment methods do you accept?", "We accept cash, bank transfer, and all major credit cards. Invoice terms available for regular clients."],
        ["Do you offer a workmanship guarantee?", "Yes, all our work comes with a workmanship guarantee. We stand behind the quality of every job."],
      ];
      if (/web|digital|agenc|seo|market|studio/i.test(ind)) return [
        ["How long does it take to build a website?", "Most websites are completed within 10–14 business days from the time we receive your content and approval."],
        ["What is included in the monthly care plan?", "The care plan includes hosting, security updates, content edits, and priority support."],
        ["Do I own my website?", "Yes — you own your website and all its content outright. We hand over full access on completion."],
        ["Can I update the website myself?", "We can set up a simple editing interface. Most clients prefer to send us edit requests — it's included in the care plan."],
        ["What happens if I'm not happy with the design?", "We offer two rounds of revisions at no extra charge. Your satisfaction is guaranteed before we go live."],
        ["Do you optimise for Google?", "Yes, every site we build includes on-page SEO, fast loading, mobile optimisation, and a Google indexing request on launch."],
      ];
      // Generic fallback
      return [
        [`What services does ${businessName} offer?`, `We offer a comprehensive range of services tailored to meet your needs. Visit our Services page or contact us directly for a full list.`],
        ["How do I get in touch?", `You can reach us by phone, email, or through the contact form on this page. We aim to respond within one business day.`],
        ["Do you offer free consultations?", "Yes, we offer a free initial consultation so we can understand your needs and explain how we can help."],
        ["What areas do you service?", "We service the local area and surrounds. Contact us to confirm we cover your location."],
        ["How long have you been in business?", `${businessName} has been serving the community for many years. We are proud of our track record and client relationships.`],
        ["What payment methods do you accept?", "We accept all major payment methods including credit card, bank transfer, and EFTPOS."],
      ];
    })();
    const faqHtml = faqItems.map(([q,a]) =>
      `<details style="background:${clrCard};border-radius:10px;padding:20px 24px;margin-bottom:12px;border:1px solid ${clrBord};cursor:pointer;">` +
      `<summary style="color:${clrText};font-weight:700;font-size:1rem;list-style:none;display:flex;justify-content:space-between;align-items:center;">${q}<span style="font-size:1.2rem;color:${clrAcct};">+</span></summary>` +
      `<p style="color:${clrText};opacity:0.8;margin:12px 0 0;font-size:0.95rem;line-height:1.7;">${a}</p>` +
      `</details>`
    ).join("");
    const faqSection = `<section id="faq" style="padding:80px 24px;background:${clrBg2};"><div style="max-width:800px;margin:0 auto;"><h2 style="color:${clrText};font-size:2rem;font-weight:900;margin:0 0 40px;">Frequently Asked Questions</h2>${faqHtml}</div></section>`;
    fixed = addSectionIdSmart(fixed, "faq", [/faq|frequently|accordion|faqs/i], [/faq|frequently asked|common questions/i], faqSection);
    mark(AuditErrorType.MISSING_FAQ);
  }

  // Fix 6: testimonials
  if (has(AuditErrorType.MISSING_TESTIMONIALS)) {
    fixed = addSectionIdSmart(fixed, "testimonials", [/testimonial|review|clients-say|feedback/i], [/testimonial|what.*client|what.*customer|what people say/i],
(() => {
      const tCards = [
        { q: `"Absolutely fantastic — professional, friendly, and great value. Couldn't be happier with the results."`, a: `— Sarah M., Brisbane` },
        { q: `"${businessName} went above and beyond. The whole experience was seamless from start to finish."`, a: "— James T., Gold Coast" },
        { q: `"Highly recommend to anyone. Quality work, on time, and exactly what we asked for."`, a: "— Priya K., Sydney" },
      ];
      const cards = tCards.map(t =>
        `<div style="background:${clrCard};border-radius:12px;padding:24px;border:1px solid ${clrBord};">` +
        `<div style="color:#f59e0b;margin-bottom:12px;">★★★★★</div>` +
        `<p style="color:${clrText};margin-bottom:16px;">${t.q}</p>` +
        `<p style="color:${clrAcct};font-weight:700;">${t.a}</p>` +
        `</div>`
      ).join("");
      return `<section id="testimonials" style="padding:80px 24px;background:${clrBg};"><div style="max-width:900px;margin:0 auto;"><h2 style="color:${clrText};font-size:2rem;font-weight:900;margin-bottom:32px;">What Our Clients Say</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">${cards}</div></div></section>`;
    })()
    );
    mark(AuditErrorType.MISSING_TESTIMONIALS);
  }

  // Fix 7: copyright — only mark fixed if HTML actually changed after insert
  if (has(AuditErrorType.MISSING_COPYRIGHT)) {
    const beforeCopy = fixed;
    const copyDiv = '<div style="text-align:center;padding:12px 0;font-size:13px;opacity:0.7;">© ' + yr + ' ' + businessName + '. All rights reserved.</div>';
    if (fixed.includes("</footer>")) {
      fixed = fixed.replace(/([\s\S]*?)(<\/footer>)/i, (m: string, body: string, close: string) => {
        if (body.includes("©") || body.includes("&copy;")) return m;
        return body + '\n' + copyDiv + '\n' + close;
      });
    } else if (fixed.includes("</body>")) {
      fixed = fixed.replace("</body>", copyDiv + '\n</body>');
    } else {
      // No </body> — append safe closing structure
      fixed = fixed.trimEnd() + '\n' + copyDiv + '\n</body>\n</html>';
    }
    // Only mark as fixed if copyright is now actually present
    if (fixed.includes("©") || fixed.includes("&copy;")) {
      mark(AuditErrorType.MISSING_COPYRIGHT);
    } else {
      console.warn("[Auditor] MISSING_COPYRIGHT: could not inject copyright — no anchor found");
    }
  }

  // Fix: Inject legal pages (Terms + Privacy) if not already present
  fixed = injectLegalPages(fixed, {
    businessName,
    clientEmail,
    businessAddress: businessAddress || "",
    abn,
    domain,
    features: context.features || [],
    ga4: !!(context.features || []).includes("Google Analytics") || fixed.includes("G-"),
    dark,
    clrBg, clrBg2, clrCard, clrText, clrSub, clrBord, clrAcct,
    yr,
  });

  // Ensure </body></html> exists — append if missing (handles Claude truncation)
  if (!fixed.includes("</body>") || !fixed.includes("</html>")) {
    console.warn("[Auditor] Missing </body> or </html> — appending safe closing tags");
    const stripped = fixed.trimEnd();
    if (!stripped.endsWith("</html>")) {
      if (!stripped.endsWith("</body>")) {
        fixed = stripped + "\n</body>\n</html>";
      } else {
        fixed = stripped + "\n</html>";
      }
    }
  }

  // Fix 8: booking placeholder (step6c replaces with real component)
  if (hasBooking && has(AuditErrorType.MISSING_BOOKING)) {
    fixed = addSectionIdSmart(fixed, "booking", [/booking|appointment|schedule|reserve/i], [/book|appointment|schedule|reserve/i], '<div id="booking"></div>');
    mark(AuditErrorType.MISSING_BOOKING);
  }

  // Fix 9: multi-page broken nav links — map text to normalized page id
  if (isMultiPage && has(AuditErrorType.BROKEN_NAV_LINKS)) {
    const pageIds = context.pages.map((p: string) => normalizePageId(p));
    fixed = fixed.replace(/<a([^>]*)href="#"([^>]*)>([\s\S]*?)<\/a>/g, (m: string, before: string, after: string, inner: string) => {
      if (before.includes("onclick") || after.includes("onclick")) return m;
      const text = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
      const matched = pageIds.find((id: string) => text.includes(id) || id.includes(text.replace(/\s+/g,"-")));
      const target = matched || (text.includes("book") ? "booking" : text.includes("contact") ? "contact" : text.includes("about") ? "about" : text.includes("service") ? "services" : "home");
      return "<a" + before + 'href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo(\'' + target + '\')"' + after + ">" + inner + "</a>";
    });
    mark(AuditErrorType.BROKEN_NAV_LINKS);
  }

  const issueStrings = issues.map(i => i.detail);
  console.log("[Auditor] Fixed " + issues.filter(i => i.fixed).length + "/" + issues.length + " issues");
  return { passed: false, issues, issueStrings, fixedHtml: fixed };
}

function injectLegalPages(html: string, ctx: {
  businessName: string; clientEmail: string; businessAddress: string;
  abn: string; domain: string; features: string[]; ga4: boolean;
  dark: boolean; clrBg: string; clrBg2: string; clrCard: string;
  clrText: string; clrSub: string; clrBord: string; clrAcct: string; yr: number;
}): string {
  const hasTerms   = /id="terms"|data-page="terms"/i.test(html);
  const hasPrivacy = /id="privacy"|data-page="privacy"/i.test(html);
  if (hasTerms && hasPrivacy) return html;

  const { businessName, clientEmail, businessAddress, abn, domain, features, ga4,
          clrBg, clrBg2, clrCard, clrText, clrSub, clrBord, clrAcct, yr } = ctx;

  const siteName   = businessName || "This Website";
  const siteUrl    = domain ? (domain.startsWith("http") ? domain : "https://" + domain) : "";
  const contactLine = [businessAddress, clientEmail].filter(Boolean).join(" · ");
  const abnLine    = abn ? ` ABN ${abn}.` : "";

  const hasShop    = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const hasContact = features.includes("Contact Form") || true; // always true — contact form is universal
  const hasNewsletter = features.includes("Newsletter Signup");
  const hasChat    = features.includes("Live Chat");

  // ── shared styles ──
  const prose = `color:${clrText};font-size:0.95rem;line-height:1.8;margin-bottom:16px;`;
  const h2s   = `color:${clrText};font-size:1.4rem;font-weight:800;margin:32px 0 12px;`;
  const h3s   = `color:${clrText};font-size:1.1rem;font-weight:700;margin:20px 0 8px;`;
  const wrap  = `max-width:800px;margin:0 auto;padding:60px 24px 80px;`;

  // ── PRIVACY POLICY ──
  const privacyHtml = !hasPrivacy ? `
<div id="privacy" data-page="privacy" style="background:${clrBg};display:none;">
  <div style="${wrap}">
    <h1 style="color:${clrText};font-size:2rem;font-weight:900;margin-bottom:8px;">Privacy Policy</h1>
    <p style="${clrSub};font-size:0.85rem;margin-bottom:32px;color:${clrSub};">Last updated: ${new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" })}</p>

    <p style="${prose}">${siteName}${abnLine} ("we", "us", "our") is committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).</p>

    <h2 style="${h2s}">1. Information We Collect</h2>
    <p style="${prose}">We may collect the following types of personal information:</p>
    <ul style="color:${clrText};line-height:2;padding-left:20px;margin-bottom:16px;">
      ${hasContact ? `<li>Contact details you submit via our enquiry form (name, email, phone number, message)</li>` : ""}
      ${hasBooking ? `<li>Booking information including your name, contact details, and appointment preferences</li>` : ""}
      ${hasShop ? `<li>Order details including your name, delivery address, and transaction information processed securely via Square</li>` : ""}
      ${hasNewsletter ? `<li>Email address if you subscribe to our newsletter or marketing communications</li>` : ""}
      ${ga4 ? `<li>Browsing behaviour and usage data collected automatically via Google Analytics (anonymised IP addresses)</li>` : ""}
      ${hasChat ? `<li>Chat messages and support enquiries submitted via our live chat feature</li>` : ""}
      <li>Technical information such as browser type, device type, and referring URL (collected automatically by our hosting provider)</li>
    </ul>

    <h2 style="${h2s}">2. How We Use Your Information</h2>
    <p style="${prose}">We use your personal information to:</p>
    <ul style="color:${clrText};line-height:2;padding-left:20px;margin-bottom:16px;">
      <li>Respond to your enquiries and provide the services you request</li>
      ${hasBooking ? `<li>Manage bookings and send appointment confirmations or reminders</li>` : ""}
      ${hasShop ? `<li>Process your orders and arrange fulfilment</li>` : ""}
      ${hasNewsletter ? `<li>Send you marketing communications you have opted in to receive (you may unsubscribe at any time)</li>` : ""}
      ${ga4 ? `<li>Analyse website usage to improve user experience (via Google Analytics — no personally identifiable information is transmitted)</li>` : ""}
      <li>Comply with legal obligations</li>
    </ul>

    <h2 style="${h2s}">3. Disclosure of Your Information</h2>
    <p style="${prose}">We do not sell, rent, or trade your personal information to third parties. We may disclose your information to:</p>
    <ul style="color:${clrText};line-height:2;padding-left:20px;margin-bottom:16px;">
      ${hasShop ? `<li><strong>Square Australia</strong> — for secure payment processing. Square's privacy policy applies to payment data.</li>` : ""}
      ${ga4 ? `<li><strong>Google LLC</strong> — for website analytics via Google Analytics. Data is processed in accordance with Google's privacy policy.</li>` : ""}
      ${hasChat ? `<li>Live chat service providers who assist in managing customer enquiries</li>` : ""}
      <li>Our hosting provider and IT service suppliers who assist in operating this website, under strict confidentiality obligations</li>
      <li>Law enforcement or regulatory bodies where required by law</li>
    </ul>

    <h2 style="${h2s}">4. Data Storage and Security</h2>
    <p style="${prose}">Your personal information is stored securely and protected by reasonable technical and organisational measures. While we take all reasonable precautions, no data transmission over the internet can be guaranteed as completely secure.</p>

    <h2 style="${h2s}">5. Your Rights</h2>
    <p style="${prose}">You have the right to access, correct, or request deletion of personal information we hold about you. To make a request, contact us at <a href="mailto:${clientEmail}" style="color:${clrAcct};">${clientEmail}</a>. We will respond within 30 days.</p>

    <h2 style="${h2s}">6. Cookies</h2>
    <p style="${prose}">This website may use cookies and similar technologies to improve your browsing experience${ga4 ? " and collect anonymised analytics data via Google Analytics" : ""}. You can disable cookies in your browser settings, though some features may not function as intended.</p>

    <h2 style="${h2s}">7. Links to Other Websites</h2>
    <p style="${prose}">Our website may contain links to external sites. We are not responsible for the privacy practices or content of those sites.</p>

    <h2 style="${h2s}">8. Changes to This Policy</h2>
    <p style="${prose}">We may update this Privacy Policy from time to time. The current version will always be available on this page.</p>

    <h2 style="${h2s}">9. Contact Us</h2>
    <p style="${prose}">For any privacy-related enquiries or complaints, please contact us at:<br>
    <strong>${siteName}</strong><br>
    ${contactLine ? contactLine + "<br>" : ""}
    <a href="mailto:${clientEmail}" style="color:${clrAcct};">${clientEmail}</a>
    </p>

    <p style="color:${clrSub};font-size:0.8rem;margin-top:40px;">If you are not satisfied with our response, you may contact the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" style="color:${clrAcct};">www.oaic.gov.au</a>.</p>
  </div>
</div>` : "";

  // ── TERMS OF SERVICE ──
  const termsHtml = !hasTerms ? `
<div id="terms" data-page="terms" style="background:${clrBg2};display:none;">
  <div style="${wrap}">
    <h1 style="color:${clrText};font-size:2rem;font-weight:900;margin-bottom:8px;">Terms of Service</h1>
    <p style="font-size:0.85rem;margin-bottom:32px;color:${clrSub};">Last updated: ${new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" })}</p>

    <p style="${prose}">Please read these Terms of Service carefully before using${siteUrl ? ` <a href="${siteUrl}" style="color:${clrAcct};">${siteUrl}</a>` : " this website"} (the "Site") operated by <strong>${siteName}</strong>${abnLine} ("we", "us", "our").</p>
    <p style="${prose}">By accessing or using this Site, you agree to be bound by these Terms. If you do not agree, please do not use this Site.</p>

    <h2 style="${h2s}">1. Use of This Website</h2>
    <p style="${prose}">You may use this Site for lawful purposes only. You must not use this Site in any way that breaches applicable laws or regulations, or that is fraudulent or harmful.</p>

    <h2 style="${h2s}">2. Intellectual Property</h2>
    <p style="${prose}">All content on this Site — including text, images, logos, and graphics — is owned by or licensed to ${siteName} and is protected by Australian copyright law. You may not reproduce, distribute, or create derivative works without our express written permission.</p>

    <h2 style="${h2s}">3. Services and Accuracy</h2>
    <p style="${prose}">The information on this Site is provided in good faith and for general informational purposes only. We make no representations or warranties about the accuracy, completeness, or suitability of this information for any particular purpose.</p>
    ${hasShop ? `<h3 style="${h3s}">Online Orders</h3><p style="${prose}">By placing an order through this Site, you agree that all information you provide is accurate. We reserve the right to cancel orders at our discretion. Payments are processed securely via Square. Refund and return policies are available on request.</p>` : ""}
    ${hasBooking ? `<h3 style="${h3s}">Bookings and Appointments</h3><p style="${prose}">Bookings made through this Site are subject to availability. Cancellation policies apply — please contact us if you need to reschedule or cancel. We reserve the right to reschedule or cancel appointments with reasonable notice.</p>` : ""}

    <h2 style="${h2s}">4. Limitation of Liability</h2>
    <p style="${prose}">To the maximum extent permitted by law, ${siteName} excludes all liability for any loss or damage arising from your use of this Site or any information on it, including but not limited to indirect, incidental, or consequential loss.</p>
    <p style="${prose}">Nothing in these Terms excludes any rights you may have under the Australian Consumer Law.</p>

    <h2 style="${h2s}">5. Third-Party Links</h2>
    <p style="${prose}">This Site may contain links to third-party websites. These links are provided for convenience only. We have no control over third-party sites and accept no responsibility for their content or privacy practices.</p>

    <h2 style="${h2s}">6. Privacy</h2>
    <p style="${prose}">Your use of this Site is also governed by our <a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('privacy')" style="color:${clrAcct};">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

    <h2 style="${h2s}">7. Governing Law</h2>
    <p style="${prose}">These Terms are governed by the laws of Australia. Any disputes will be subject to the exclusive jurisdiction of the courts of Australia.</p>

    <h2 style="${h2s}">8. Changes to These Terms</h2>
    <p style="${prose}">We may update these Terms at any time. The current version will always be available on this page. Continued use of the Site after changes are posted constitutes acceptance of the updated Terms.</p>

    <h2 style="${h2s}">9. Contact</h2>
    <p style="${prose}">If you have questions about these Terms, contact us at:<br>
    <strong>${siteName}</strong><br>
    ${contactLine ? contactLine + "<br>" : ""}
    <a href="mailto:${clientEmail}" style="color:${clrAcct};">${clientEmail}</a>
    </p>
  </div>
</div>` : "";

  // Inject before </body> and add footer links
  let result = html;

  if (privacyHtml || termsHtml) {
    result = result.replace("</body>", privacyHtml + termsHtml + "\n</body>");
    console.log("[Auditor] Injected legal pages: " + [!hasPrivacy && "privacy", !hasTerms && "terms"].filter(Boolean).join(", "));
  }

  // Wire footer links — find the footer and add links if not already there
  if (!result.includes('navigateTo(\'terms\'') && !result.includes('navigateTo("terms"')) {
    const legalFooter = `<div style="text-align:center;padding:8px 0 4px;font-size:12px;">` +
      `<a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('privacy')" style="color:${clrSub};text-decoration:none;margin:0 10px;">Privacy Policy</a>` +
      `<span style="color:${clrBord};">|</span>` +
      `<a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('terms')" style="color:${clrSub};text-decoration:none;margin:0 10px;">Terms of Service</a>` +
      `</div>`;
    if (result.includes("</footer>")) {
      result = result.replace(/([\s\S]*?)<\/footer>/i, (m: string, body: string) => body + legalFooter + "</footer>");
    } else {
      // Inject before closing body
      result = result.replace("</body>", legalFooter + "\n</body>");
    }
  }

  return result;
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
    const re = new RegExp('<h[1-4][^>]*>([^<]*)<\/h[1-4]>', 'gi');
    let hm; let pos = -1; let ht = '';
    re.lastIndex = 0;
    while ((hm = re.exec(html)) !== null) { if (hp.test(hm[1])) { pos = hm.index; ht = hm[1].trim(); break; } }
    if (pos === -1) continue;
    const tagRe = new RegExp('<(section|div)(\s[^>]*)?>',  'gi');
    let tm; let bStart = -1; let bStr = '';
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
  // For multi-page sites: inject inside the home page wrapper so the section
  // only appears on the home page, not on every page.
  const homeWrapperRe = /(<[^>]+data-page=["']home["'][^>]*>)([\s\S]*?)(<\/(?:section|div)>(?=[\s\S]*?(?:data-page|<\/body>)))/i;
  if (homeWrapperRe.test(html)) {
    return html.replace(homeWrapperRe, (_m: string, open: string, inner: string, close: string) => {
      if (inner.includes('id="' + id + '"')) return _m; // already injected
      return open + inner + fallbackSection + "\n" + close;
    });
  }
  // Single-page: inject before footer if one exists, otherwise before </body>
  if (/<footer[\s>]/i.test(html)) {
    return html.replace(/<footer[\s>]/i, fallbackSection + '\n<footer ');
  }
  return html.replace('</body>', fallbackSection + '\n</body>');
}

