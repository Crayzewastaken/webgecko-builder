// lib/pipeline-helpers.ts
// Shared helpers used by both worker/route.ts (intake) and pipeline/run/route.ts (build)

// ─── normalizePageId ──────────────────────────────────────────────────────────
// Converts a page label like "About Us" → "about", "Book Appointment" → "booking".
// Canonical alias map ensures consistency across inngest, fix routes, and auditor.

const PAGE_ALIASES: Record<string, string> = {
  "about-us": "about",
  "about-page": "about",
  "contact-us": "contact",
  "contact-page": "contact",
  "book-appointment": "booking",
  "book-now": "booking",
  "book-online": "booking",
  "appointments": "booking",
  "our-services": "services",
  "what-we-do": "services",
  "service": "services",
  "our-work": "gallery",
  "portfolio": "gallery",
  "photo-gallery": "gallery",
  "our-prices": "pricing",
  "price-list": "pricing",
  "packages": "pricing",
  "faq": "faq",
  "faqs": "faq",
  "frequently-asked-questions": "faq",
  "home-page": "home",
};

export function normalizePageId(label: string): string {
  const slug = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return PAGE_ALIASES[slug] ?? slug;
}


// ─── extractJson ──────────────────────────────────────────────────────────────

export function extractJson(text: string) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON braces found");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    const titleMatch = text.match(/"projectTitle"\s*:\s*"([^"]+)"/);
    const promptMatch = text.match(/"stitchPrompt"\s*:\s*"([\s\S]+)/);
    let stitchPrompt = promptMatch?.[1] || text;
    stitchPrompt = stitchPrompt.replace(/"\s*}?\s*$/, "").replace(/\\n/g, "\n").slice(0, 4000);
    console.warn("extractJson: truncated — using regex fallback");
    return { projectTitle: titleMatch?.[1] || "Website Project", stitchPrompt };
  }
}

// ─── safeFileName ─────────────────────────────────────────────────────────────

export function safeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

// ─── calculateQuote ───────────────────────────────────────────────────────────

export function calculateQuote(userInput: Record<string, unknown>) {
  const pageCount = Array.isArray(userInput.pages) ? userInput.pages.length : 1;
  const features = Array.isArray(userInput.features) ? userInput.features : [];
  const isMultiPage = userInput.siteType === "multi";
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const hasBlog = features.includes("Blog");

  // Package based on page count — features are add-ons, not package triggers
  let packageName = "Starter"; let basePrice = 1500; let competitorPrice = 3000;
  const breakdown: string[] = [];
  if (pageCount >= 7 || (isMultiPage && pageCount >= 5)) { packageName = "Premium"; basePrice = 3800; competitorPrice = 12000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = "Business"; basePrice = 2400; competitorPrice = 6500; }
  breakdown.push(`${packageName} package (${pageCount} pages): $${basePrice.toLocaleString()}`);

  let addons = 0;
  if (hasBooking) { addons += 400; breakdown.push("Booking system: +$400"); }
  if (hasEcommerce) { addons += 600; breakdown.push("Online shop (Square): +$600"); }
  if (hasBlog) { addons += 200; breakdown.push("Blog: +$200"); }
  if (features.includes("Photo Gallery")) { addons += 150; breakdown.push("Gallery: +$150"); }
  if (features.includes("Reviews & Testimonials")) { addons += 100; breakdown.push("Reviews: +$100"); }
  if (features.includes("Live Chat")) { addons += 150; breakdown.push("Live chat: +$150"); }
  if (features.includes("Newsletter Signup")) { addons += 100; breakdown.push("Newsletter: +$100"); }
  if (features.includes("Video Background")) { addons += 200; breakdown.push("Video hero: +$200"); }

  const totalPrice = basePrice + addons;
  // Monthly: $109/month intro for 3 months, then $119/month ongoing
  const monthlyPrice = 109; // intro rate (first 3 months)
  const monthlyOngoing = 119; // standard ongoing rate
  const savings = competitorPrice - totalPrice;
  breakdown.push(`Monthly hosting: $${monthlyPrice}/month (first 3 months), then $${monthlyOngoing}/month`);
  return { package: packageName, price: totalPrice, monthlyPrice, monthlyOngoing, savings, competitorPrice, breakdown };
}

// ─── extractCSS ───────────────────────────────────────────────────────────────

export function extractCSS(html: string): string {
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    if (!match[1].includes("tailwind") && match[1].trim().length > 10) styleBlocks.push(match[1].trim());
  }
  const tailwindMatch = html.match(/tailwind\.config\s*=\s*({[\s\S]*?})\s*<\/script>/);
  let colorVars = "";
  if (tailwindMatch) {
    try {
      const config = eval("(" + tailwindMatch[1] + ")");
      const colors = config?.theme?.extend?.colors || {};
      colorVars = "/* THEME COLORS */\n:root {\n";
      Object.entries(colors).forEach(([key, val]) => { colorVars += `  --color-${key}: ${val};\n`; });
      colorVars += "}\n";
    } catch {}
  }
  return `/* WebGecko Generated Styles */\n\n${colorVars}\n${styleBlocks.join("\n\n")}`;
}

// ─── checkAndFixLinks ─────────────────────────────────────────────────────────

// ─── Fix navigateTo targets at HTML level ─────────────────────────────────────
// Stitch often sets onclick="navigateTo('home')" on ALL nav links regardless of label.
// This function rewrites navigateTo targets based on the link's visible text content.
export function fixNavigateToTargets(html: string): string {
  const labelMap: Record<string, string> = {
    "home": "home", "about": "about", "about us": "about",
    "services": "services", "our services": "services", "what we do": "services",
    "booking": "booking", "book": "booking", "book now": "booking",
    "appointments": "booking", "book an appointment": "booking", "reserve": "booking",
    "schedule": "booking", "book a session": "booking", "book online": "booking",
    "contact": "contact", "contact us": "contact", "get in touch": "contact",
    "enquire": "contact", "enquire now": "contact",
    "gallery": "gallery", "our work": "gallery", "portfolio": "gallery",
    "faq": "faq", "faqs": "faq", "questions": "faq",
    "testimonials": "testimonials", "reviews": "testimonials",
    "pricing": "pricing", "prices": "pricing", "packages": "pricing",
    "shop": "shop", "store": "shop", "products": "shop",
    "blog": "blog", "news": "blog", "articles": "blog",
    "team": "team", "our team": "team",
    "menu": "menu",
  };

  // Match any element with onclick containing navigateTo and extract inner text
  return html.replace(
    /(<(?:a|button)([^>]*onclick=["'][^"']*navigateTo\(['"](\w+)['"]\)[^"']*["'][^>]*)>)([\s\S]*?)(<\/(?:a|button)>)/gi,
    (match, openTag, attrs, currentTarget, innerContent, closeTag) => {
      // Get visible text from inner content
      const text = innerContent.replace(/<[^>]+>/g, "").trim().toLowerCase();
      const mappedTarget = labelMap[text];
      if (mappedTarget && mappedTarget !== currentTarget) {
        const fixedTag = openTag.replace(
          /navigateTo\(['"](\w+)['"]\)/,
          `navigateTo('${mappedTarget}')`
        );
        console.log(`[fixNavigateTo] "${text}": '${currentTarget}' → '${mappedTarget}'`);
        return fixedTag + innerContent + closeTag;
      }
      return match;
    }
  );
}

export function checkAndFixLinks(html: string, pages: string[]): { html: string; report: string[] } {
  const issues: string[] = [];
  let fixed = html;

  const navigateCalls = [...html.matchAll(/navigateTo\(['"]([^'"]+)['"]\)/g)];
  const allTargets = [...new Set(navigateCalls.map(m => m[1]))];
  const missing = allTargets.filter(id => !new RegExp(`id=["']${id}["']`).test(html));

  missing.forEach(id => {
    issues.push(`navigateTo('${id}') has no matching element`);
    console.log(`Link Check: navigateTo('${id}') has no matching element`);
  });

  for (const pageId of missing) {
    // Strategy A: class/data attribute contains the id name
    const classMatch = new RegExp(
      `(<(?:section|div|article|main)[^>]*?(?:class|data-page|data-section)=["'][^"']*${pageId}[^"']*["'][^>]*>)`, "i"
    ).exec(fixed);
    if (classMatch && !/\bid=/.test(classMatch[1])) {
      fixed = fixed.replace(classMatch[1], classMatch[1].replace(">", ` id="${pageId}">`));
      console.log(`Link Fix [A]: id="${pageId}" via class match`);
      continue;
    }

    // Strategy B: scan heading text for semantic match
    const escapedId = pageId.replace(/[-_]/g, "[\\s\\-_]?");
    const headingPattern = new RegExp(
      "(<(?:section|div|article|main)(?:[^>](?!id=))*>)(?:[\\s\\S]{0,2000}?)<(?:h1|h2|h3)[^>]*>[^<]*" + escapedId + "[^<]*</(?:h1|h2|h3)>",
      "i"
    );
    const headingMatch = headingPattern.exec(fixed);
    if (headingMatch && !/\bid=/.test(headingMatch[1])) {
      fixed = fixed.replace(headingMatch[1], headingMatch[1].replace(/>$/, ` id="${pageId}">`));
      console.log(`Link Fix [B]: id="${pageId}" via heading text match`);
      continue;
    }

    // Strategy C: find [data-page="pageId"] wrapper missing its id, or first un-id'd .page-section
    let injectedC = false;
    {
      const dpRe = new RegExp(`<(div|section|article|main)([^>]*\\bdata-page=["']${pageId}["'][^>]*)>`, "i");
      const dpM = dpRe.exec(fixed);
      if (dpM && !/\bid=["']/.test(dpM[2])) {
        fixed = fixed.slice(0, dpM.index) + `<${dpM[1]}${dpM[2]} id="${pageId}">` + fixed.slice(dpM.index + dpM[0].length);
        injectedC = true;
        console.log(`Link Fix [C-dp]: added id="${pageId}" to [data-page] wrapper`);
      }
    }
    if (!injectedC && !fixed.includes(`id="${pageId}"`)) {
      fixed = fixed.replace(/<div([^>]*class="[^"]*page-section[^"]*"[^>]*)>/g, (m: string, attrs: string) => {
        if (injectedC || attrs.includes("id=")) return m;
        injectedC = true;
        console.log(`Link Fix [C-ps]: id="${pageId}" on first un-id'd page-section`);
        return `<div${attrs} id="${pageId}">`;
      });
    }
    if (injectedC) continue;

    // Strategy D: inject a real styled section before </body>
    const sectionTemplates: Record<string, string> = {
      contact: `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:600px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:8px;">Contact Us</h2><p style="color:#94a3b8;margin-bottom:24px;">Get in touch and we will respond within 24 hours.</p><form style="display:flex;flex-direction:column;gap:16px;" onsubmit="event.preventDefault();this.innerHTML='<p style=color:#22c55e;font-weight:bold;font-size:1.1rem;>Thank you! We will be in touch shortly.</p>'"><input type="text" placeholder="Your Name" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><input type="email" placeholder="Your Email" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><input type="tel" placeholder="Your Phone" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><textarea placeholder="Your Message" rows="5" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea><button type="submit" style="background:#10b981;color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button></form></div></div>`,
      about: `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:16px;">About Us</h2><p style="color:#94a3b8;font-size:1.1rem;line-height:1.8;">We are a dedicated team committed to delivering exceptional results for our clients. With years of experience in the industry, we pride ourselves on quality, reliability, and customer satisfaction.</p></div></div>`,
      services: `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0a0f1a;"><div style="max-width:900px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Our Services</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px;"><div style="background:#1e293b;border-radius:12px;padding:28px;"><h3 style="color:#10b981;margin-bottom:8px;">Professional Service</h3><p style="color:#94a3b8;">High quality results delivered on time and on budget.</p></div></div></div></div>`,
      pricing: `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Pricing</h2><p style="color:#94a3b8;">Contact us for a custom quote tailored to your needs.</p></div></div>`,
      gallery: `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0a0f1a;"><div style="max-width:1000px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Gallery</h2><p style="color:#94a3b8;">Our portfolio of recent work.</p></div></div>`,
    };

    const templateKey = Object.keys(sectionTemplates).find(k => new RegExp(k, "i").test(pageId));
    const injectedHtml = templateKey
      ? sectionTemplates[templateKey]
      : `<div class="page-section" data-page="${pageId}" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;text-align:center;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:16px;">${pageId.charAt(0).toUpperCase() + pageId.slice(1)}</h2><p style="color:#94a3b8;">Content coming soon.</p></div></div>`;

    fixed = fixed.replace("</body>", `${injectedHtml}\n</body>`);
    console.log(`Link Fix [D]: injected "${templateKey || "generic"}" section for id="${pageId}"`);
  }

  const firstTarget = allTargets[0] || "contact";
  fixed = fixed.replace(/href="#"(?=[^>]*>(?:Book Now|Get Started|Join Now|Contact Us|Sign Up|Learn More|Get Quote)[^<]*<)/gi,
    `onclick="window.navigateTo && window.navigateTo('${firstTarget}')" href="#"`);

  const deadLinks = (html.match(/href="#"(?!\w)/g) || []).length;
  if (deadLinks) issues.push(`Found ${deadLinks} dead href="#" links`);

  return { html: fixed, report: issues };
}

// ─── repairHtml ──────────────────────────────────────────────────────────────
// Conservative HTML structural repair. Ensures DOCTYPE, <html>, <head>, <body>,
// closing </footer>, </body>, </html>. Does NOT rewrite content.
// Call after Claude rebuild and before any downstream injection.

export function repairHtml(html: string, businessName: string, year: number): string {
  let out = html.trim();

  // 1. Truncated trailing attribute — e.g. `<a href="` at end (Claude cut off mid-tag)
  //    Strip anything after the last complete tag close before injected content lands.
  out = out.replace(/<[a-zA-Z][^>]*(?=<script\b)/gi, "");
  out = out.replace(/<[a-zA-Z][^>]*$/, "");  // remove incomplete trailing open tag

  // 2. Ensure DOCTYPE + html wrapper
  if (!out.startsWith("<!DOCTYPE") && !out.startsWith("<!doctype")) {
    if (!out.includes("<html")) {
      out = `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body>\n${out}\n</body>\n</html>`;
    } else {
      out = `<!DOCTYPE html>\n${out}`;
    }
  }

  // 3. Ensure <head> exists
  if (!out.includes("<head")) {
    out = out.replace("<html", "<html").replace(/<html([^>]*)>/, `<html$1>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`);
  }

  // 4. Ensure <body> exists
  if (!/<body[\s>]/.test(out)) {
    out = out.replace("</head>", "</head>\n<body>");
    if (!out.includes("</body>")) out += "\n</body>";
  }

  // 5. Ensure </footer> if <footer> exists
  if (out.includes("<footer") && !out.includes("</footer>")) {
    // Find position of last </body> or </html> and insert </footer> before it
    const insertBefore = out.includes("</body>") ? "</body>" : "</html>";
    out = out.replace(new RegExp(`(?=<\/body>|<\/html>)`, "i"), "</footer>\n");
  }

  // 6. Ensure copyright in footer if missing
  if (!out.includes("&copy;") && !out.includes("All rights reserved")) {
    const copy = `<div style="text-align:center;padding:12px 0;font-size:12px;opacity:0.6;">&copy; ${year} ${businessName}. All rights reserved.</div>`;
    if (out.includes("</footer>")) {
      out = out.replace("</footer>", copy + "\n</footer>");
    } else if (out.includes("</body>")) {
      out = out.replace("</body>", copy + "\n</body>");
    }
  }

  // 7. Ensure </body></html> at end
  const stripped = out.trimEnd();
  if (!stripped.endsWith("</html>")) {
    if (!stripped.endsWith("</body>")) {
      out = stripped + "\n</body>\n</html>";
    } else {
      out = stripped + "\n</html>";
    }
  }

  return out;
}

// ─── validateForDeploy ───────────────────────────────────────────────────────
// Final validation before deploy. Returns list of failures (empty = OK).
export function validateForDeploy(
  html: string,
  requestedPageIds: string[],
  isMultiPage: boolean,
  hasBooking: boolean,
): string[] {
  const failures: string[] = [];

  // Structural
  if (!html.includes("</body>")) failures.push("Missing </body>");
  if (!html.includes("</html>")) failures.push("Missing </html>");
  if (html.length < 8000) failures.push(`HTML too short (${html.length} chars)`);

  // Truncated trailing tag — e.g. ends with `<a href="`
  if (/<[a-zA-Z][^>]*$/.test(html.trimEnd())) failures.push("Truncated trailing tag at end of HTML");
  if (/<[a-zA-Z][^>]*(?=<script\b)/i.test(html)) failures.push("Truncated tag before injected script");

  if (isMultiPage) {
    // 1. Every requested page must have a data-page wrapper
    for (const id of requestedPageIds) {
      if (!html.includes(`data-page="${id}"`)) {
        failures.push(`Missing data-page="${id}" wrapper`);
      }
    }

    // 2. Must have some data-page wrappers at all
    const allDataPages = (html.match(/\bdata-page=["']([^"']+)["']/g) || []);
    if (allDataPages.length === 0) {
      failures.push("No data-page wrappers found at all");
    }

    // 3. No duplicate data-page values
    const dpValues = allDataPages.map(m => (m.match(/data-page=["']([^"']+)["']/) || [])[1]).filter(Boolean);
    const seen = new Set<string>();
    for (const v of dpValues) {
      if (seen.has(v)) failures.push(`Duplicate data-page="${v}"`);
      seen.add(v);
    }

    // 4. Exactly one wrapper must have class="... active ..."
    const activeCount = (html.match(/\bdata-page=["'][^"']+["'][^>]*class="[^"]*\bactive\b/g) || []).length
      + (html.match(/\bclass="[^"]*\bactive\b[^"]*"[^>]*data-page=/g) || []).length;
    if (activeCount === 0) failures.push("No data-page wrapper has class 'active'");
    if (activeCount > 1)   failures.push(`Multiple data-page wrappers (${activeCount}) have class 'active'`);

    // 5. No requested page wrapper should be empty/tiny (< 300 stripped chars)
    for (const id of requestedPageIds) {
      const wrapperRe = new RegExp(`data-page=["']${id}["'][\\s\\S]{0,5000}`, "i");
      const wm = wrapperRe.exec(html);
      if (wm) {
        const textContent = wm[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (textContent.length < 300) failures.push(`data-page="${id}" appears empty or very thin (${textContent.length} visible chars)`);
      }
    }

    // 6. No navigateTo() target that points to a page NOT in requestedPageIds
    const navTargets = [...html.matchAll(/navigateTo\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
    for (const t of navTargets) {
      if (!requestedPageIds.includes(t)) {
        failures.push(`navigateTo('${t}') points to page not in requestedPageIds`);
      }
    }

    // 7. Booking page must not exist unless booking was requested
    if (!hasBooking && !requestedPageIds.includes("booking") && html.includes('data-page="booking"')) {
      failures.push('Surprise data-page="booking" exists but booking was not requested');
    }

    // 8. Required semantic IDs
    if (requestedPageIds.includes("contact") && !html.includes('id="contact"')) {
      failures.push('Contact page requested but id="contact" is missing inside it');
    }
    if (requestedPageIds.includes("faq") && !html.includes('id="faq"')) {
      failures.push('FAQ page requested but id="faq" is missing');
    }
  } else {
    // Single-page: hero ID required
    if (!html.includes('id="hero"') && !html.includes("id='hero'")) {
      failures.push('Missing id="hero"');
    }
  }

  if (hasBooking && !html.includes('id="booking"') && !html.includes("id='booking'")) {
    failures.push('Missing id="booking"');
  }

  return failures;
}

// ─── extractStitchSections ────────────────────────────────────────────────────
// Pull named sections out of Stitch HTML by id or class. Used to build a
// structured section inventory even when the full body is too large to send.
export interface StitchSection {
  id: string;
  tag: string;
  outerHtml: string;  // full element HTML (may be large)
  snippet: string;    // first 600 chars of content text for inventory
}

export function extractStitchSections(html: string): StitchSection[] {
  const KNOWN_SECTIONS = [
    "hero", "services", "about", "testimonials", "faq", "contact",
    "booking", "gallery", "pricing", "shop", "team", "menu", "blog",
    "location", "footer",
  ];
  const found: StitchSection[] = [];
  const seen = new Set<string>();

  for (const sectionId of KNOWN_SECTIONS) {
    if (seen.has(sectionId)) continue;
    // Match <section|div|article|main id="sectionId" ...> or <... class="...sectionId..."
    const byId = new RegExp(`<(section|div|article|main)([^>]*\\bid=["']${sectionId}["'][^>]*)>`, "i").exec(html);
    const byClass = !byId
      ? new RegExp(`<(section|div|article|main)([^>]*\\bclass=["'][^"']*\\b${sectionId}\\b[^"']*["'][^>]*)>`, "i").exec(html)
      : null;
    const match = byId || byClass;
    if (!match) continue;

    const tagName = match[1].toLowerCase();
    const startIdx = match.index;
    // Walk forward to find the matching closing tag
    let depth = 1;
    let pos = startIdx + match[0].length;
    const openRe = new RegExp(`<${tagName}[\\s>]`, "gi");
    const closeRe = new RegExp(`<\\/${tagName}>`, "gi");
    let endIdx = pos;
    while (depth > 0 && pos < html.length && pos < startIdx + 80000) {
      openRe.lastIndex = pos;
      closeRe.lastIndex = pos;
      const nextOpen = openRe.exec(html);
      const nextClose = closeRe.exec(html);
      if (!nextClose) break;
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        pos = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        pos = nextClose.index + nextClose[0].length;
        if (depth === 0) endIdx = pos;
      }
    }
    const outerHtml = html.slice(startIdx, endIdx);
    const snippet = outerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
    found.push({ id: sectionId, tag: tagName, outerHtml, snippet });
    seen.add(sectionId);
  }

  return found;
}

// ─── buildSectionInventory ────────────────────────────────────────────────────
// Builds a human-readable section inventory for the Claude prompt when the full
// Stitch body is too large to include in full.
export function buildSectionInventory(sections: StitchSection[], totalBodyChars: number): string {
  if (sections.length === 0) return "(No named sections found — Stitch output may be single-block)";
  const lines = [
    `SECTION INVENTORY (${sections.length} sections found, full body ${totalBodyChars} chars):`,
    "",
  ];
  for (const s of sections) {
    lines.push(`[${s.id.toUpperCase()}] tag=<${s.tag}> size=${s.outerHtml.length}chars`);
    lines.push(`  Preview: ${s.snippet.slice(0, 250)}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ─── ensureMultiPageStructure ─────────────────────────────────────────────────
// Deterministic post-processor that guarantees every requested page has exactly
// one top-level data-page wrapper, exactly one 'active' class, clean nav targets,
// and required semantic IDs. Call after Step4b and again before validateForDeploy.
//
// Returns { html, report } where report lists every repair made.

export interface MultiPageRepairReport {
  repairs: string[];
  missingPagesAdded: string[];
  duplicatesRemoved: string[];
  navTargetsFixed: string[];
}

const FALLBACK_PAGE_CONTENT: Record<string, (businessName: string, accentColor: string) => string> = {
  home: (biz, ac) => `
    <section id="hero" style="min-height:80vh;display:flex;align-items:center;justify-content:center;padding:80px 24px;background:linear-gradient(135deg,#0a0f1a 0%,#1e293b 100%);text-align:center;">
      <div><h1 style="color:#f1f5f9;font-size:3rem;font-weight:900;margin:0 0 16px;">${biz}</h1>
      <p style="color:#94a3b8;font-size:1.2rem;margin:0 0 32px;">Quality service you can trust.</p>
      <a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('contact')" style="display:inline-block;background:${ac};color:#fff;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;font-size:1.1rem;">Get Started</a></div>
    </section>
    <section id="testimonials" style="padding:80px 24px;background:#0f172a;">
      <div style="max-width:900px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;text-align:center;margin-bottom:40px;">What Our Clients Say</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
        <div style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;"><p style="color:#e2e8f0;margin-bottom:12px;">"Absolutely fantastic service!"</p><p style="color:${ac};font-weight:700;">— Sarah M.</p></div>
        <div style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;"><p style="color:#e2e8f0;margin-bottom:12px;">"Highly recommend to anyone."</p><p style="color:${ac};font-weight:700;">— James T.</p></div>
        <div style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;"><p style="color:#e2e8f0;margin-bottom:12px;">"Professional and reliable."</p><p style="color:${ac};font-weight:700;">— Emily R.</p></div>
      </div></div>
    </section>`,
  about: (_biz, ac) => `
    <div style="padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:24px;">About Us</h2>
      <p style="color:#94a3b8;font-size:1.1rem;line-height:1.8;margin-bottom:20px;">We are a dedicated team committed to delivering exceptional results for our clients. With years of experience in the industry, we pride ourselves on quality, reliability, and customer satisfaction.</p>
      <p style="color:#94a3b8;font-size:1.1rem;line-height:1.8;">Our mission is to provide outstanding service that exceeds expectations every time.</p>
      <div style="margin-top:48px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px;">
        <div style="text-align:center;"><div style="font-size:2.5rem;font-weight:900;color:${ac};">10+</div><div style="color:#94a3b8;">Years Experience</div></div>
        <div style="text-align:center;"><div style="font-size:2.5rem;font-weight:900;color:${ac};">500+</div><div style="color:#94a3b8;">Happy Clients</div></div>
        <div style="text-align:center;"><div style="font-size:2.5rem;font-weight:900;color:${ac};">100%</div><div style="color:#94a3b8;">Satisfaction</div></div>
      </div>
    </div></div>`,
  services: (_biz, ac) => `
    <div style="padding:80px 24px;background:#0a0f1a;"><div style="max-width:1000px;margin:0 auto;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;text-align:center;margin-bottom:48px;">Our Services</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px;">
        <div style="background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;"><div style="font-size:2rem;margin-bottom:16px;">⭐</div><h3 style="color:${ac};font-size:1.3rem;font-weight:700;margin-bottom:12px;">Premium Service</h3><p style="color:#94a3b8;line-height:1.7;">High quality results delivered on time and on budget.</p></div>
        <div style="background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;"><div style="font-size:2rem;margin-bottom:16px;">🎯</div><h3 style="color:${ac};font-size:1.3rem;font-weight:700;margin-bottom:12px;">Expert Consultation</h3><p style="color:#94a3b8;line-height:1.7;">Tailored advice and guidance for your unique needs.</p></div>
        <div style="background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;"><div style="font-size:2rem;margin-bottom:16px;">🏆</div><h3 style="color:${ac};font-size:1.3rem;font-weight:700;margin-bottom:12px;">Ongoing Support</h3><p style="color:#94a3b8;line-height:1.7;">We're here for you every step of the way.</p></div>
      </div>
    </div></div>`,
  contact: (biz, ac) => `
    <div style="padding:80px 24px;background:#0f172a;"><div style="max-width:640px;margin:0 auto;">
      <h2 id="contact" style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:8px;">Contact Us</h2>
      <p style="color:#94a3b8;margin-bottom:32px;">Get in touch with ${biz} — we respond within 24 hours.</p>
      <form style="display:flex;flex-direction:column;gap:16px;" onsubmit="event.preventDefault();this.innerHTML='<p style=color:#22c55e;font-weight:bold;font-size:1.1rem;>Thank you! We will be in touch shortly.</p>'">
        <input type="text" placeholder="Your Name" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>
        <input type="email" placeholder="Your Email" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>
        <input type="tel" placeholder="Your Phone" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/>
        <textarea placeholder="Your Message" rows="5" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea>
        <button type="submit" style="background:${ac};color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button>
      </form>
    </div></div>`,
  booking: (biz, ac) => `
    <div style="padding:80px 24px;background:#0a0f1a;text-align:center;"><div style="max-width:640px;margin:0 auto;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:16px;">Book an Appointment</h2>
      <p style="color:#94a3b8;margin-bottom:32px;">Schedule your appointment with ${biz} online.</p>
      <a href="#" onclick="event.preventDefault();" style="display:inline-block;background:${ac};color:#fff;font-weight:700;font-size:1.1rem;padding:18px 48px;border-radius:10px;text-decoration:none;">Book Now</a>
    </div></div>`,
  faq: (_biz, ac) => `
    <div style="padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;">
      <h2 id="faq" style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:40px;">Frequently Asked Questions</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">How do I get started?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">Simply contact us via the form or phone and we'll be in touch within 24 hours to discuss your needs.</p></details>
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">What are your hours?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">We're available Monday to Friday, 9am–5pm. We also offer flexible appointment times.</p></details>
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">Do you offer a free consultation?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">Yes! We offer a complimentary initial consultation to understand your needs before any commitment.</p></details>
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">What areas do you service?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">We service the greater metropolitan area and surrounding suburbs. Contact us to confirm coverage in your area.</p></details>
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">How do I pay?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">We accept all major payment methods including credit card, bank transfer, and cash.</p></details>
        <details style="background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;"><summary style="color:${ac};font-weight:700;cursor:pointer;font-size:1.05rem;">Do you offer a warranty or guarantee?</summary><p style="color:#94a3b8;margin-top:12px;line-height:1.7;">Absolutely. We stand behind our work with a satisfaction guarantee. If you're not happy, we'll make it right.</p></details>
      </div>
    </div></div>`,
  pricing: (_biz, ac) => `
    <div style="padding:80px 24px;background:#0a0f1a;"><div style="max-width:900px;margin:0 auto;text-align:center;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:48px;">Pricing</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px;">
        <div style="background:#1e293b;border-radius:16px;padding:36px;border:1px solid #334155;"><h3 style="color:#f1f5f9;font-weight:700;margin-bottom:8px;">Starter</h3><div style="color:${ac};font-size:2.5rem;font-weight:900;margin-bottom:16px;">$99</div><p style="color:#94a3b8;">Perfect for individuals getting started.</p></div>
        <div style="background:${ac};border-radius:16px;padding:36px;border:1px solid ${ac};"><h3 style="color:#fff;font-weight:700;margin-bottom:8px;">Professional</h3><div style="color:#fff;font-size:2.5rem;font-weight:900;margin-bottom:16px;">$199</div><p style="color:rgba(255,255,255,0.8);">Most popular for growing businesses.</p></div>
        <div style="background:#1e293b;border-radius:16px;padding:36px;border:1px solid #334155;"><h3 style="color:#f1f5f9;font-weight:700;margin-bottom:8px;">Enterprise</h3><div style="color:${ac};font-size:2.5rem;font-weight:900;margin-bottom:16px;">Custom</div><p style="color:#94a3b8;">Tailored solutions for larger organisations.</p></div>
      </div>
    </div></div>`,
  gallery: (_biz, _ac) => `
    <div style="padding:80px 24px;background:#0f172a;"><div style="max-width:1100px;margin:0 auto;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;text-align:center;margin-bottom:48px;">Our Gallery</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">
        ${[1,2,3,4,5,6].map(i => `<div style="border-radius:12px;overflow:hidden;aspect-ratio:4/3;"><img src="https://placehold.co/400x300/1e293b/94a3b8?text=Photo+${i}" alt="Gallery image ${i}" style="width:100%;height:100%;object-fit:cover;"/></div>`).join("")}
      </div>
    </div></div>`,
};

function getFallbackContent(pageId: string, businessName: string, accentColor: string): string {
  const gen = FALLBACK_PAGE_CONTENT[pageId];
  if (gen) return gen(businessName, accentColor);
  // Generic fallback
  const label = pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, " ");
  return `
    <div style="padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;text-align:center;">
      <h2 style="color:#f1f5f9;font-size:2.5rem;font-weight:900;margin-bottom:16px;">${label}</h2>
      <p style="color:#94a3b8;font-size:1.1rem;">This page is coming soon. Please check back later.</p>
    </div></div>`;
}

export function ensureMultiPageStructure(
  html: string,
  requestedPageIds: string[],
  options: {
    businessName?: string;
    accentColor?: string;
    hasBooking?: boolean;
  } = {}
): { html: string; report: MultiPageRepairReport } {
  const report: MultiPageRepairReport = {
    repairs: [],
    missingPagesAdded: [],
    duplicatesRemoved: [],
    navTargetsFixed: [],
  };

  const businessName = options.businessName || "Business";
  const accentColor = options.accentColor || "#10b981";
  const hasBooking = options.hasBooking ?? false;

  let out = html;

  // ── 1. Detect which requested pages already have data-page wrappers ──────────
  const presentPages = requestedPageIds.filter(id => out.includes(`data-page="${id}"`));
  const missingPages = requestedPageIds.filter(id => !out.includes(`data-page="${id}"`));

  console.log(`[ensureMultiPage] Requested: [${requestedPageIds.join(",")}] | Present: [${presentPages.join(",")}] | Missing: [${missingPages.join(",")}]`);

  // ── 2. Try to wrap existing Stitch sections that have matching ids ────────────
  //    e.g. <section id="services"> → wrap in <div data-page="services" id="services" class="page-section">
  const stillMissing: string[] = [];
  for (const pageId of missingPages) {
    // Check if there's an element with id="pageId" that could be wrapped
    const idRe = new RegExp(`<(section|div|article|main)([^>]*\\bid=["']${pageId}["'][^>]*)>`, "i");
    const m = idRe.exec(out);
    if (m) {
      // Found the element — add data-page attribute to it instead of wrapping
      const fullTag = m[0];
      const newTag = fullTag.includes("data-page=")
        ? fullTag
        : fullTag.replace(/>$/, ` data-page="${pageId}">`);
      // Also ensure class="page-section" (or add it)
      const withClass = newTag.includes("page-section")
        ? newTag
        : newTag.replace(/>$/, ` class="page-section">`).replace(/class="([^"]*)"/, `class="$1 page-section"`);
      out = out.slice(0, m.index) + withClass + out.slice(m.index + fullTag.length);
      report.repairs.push(`Promoted id="${pageId}" element to data-page wrapper`);
    } else {
      // Try to find by class containing page name
      const classRe = new RegExp(`<(section|div|article|main)([^>]*class=["'][^"']*\\b${pageId}\\b[^"']*["'][^>]*)>`, "i");
      const cm = classRe.exec(out);
      if (cm && !cm[0].includes("data-page=")) {
        const hasId = /\bid=/.test(cm[2]);
        const newTag = cm[0]
          .replace(/>$/, ` data-page="${pageId}"${hasId ? "" : ` id="${pageId}"`}>`);
        out = out.slice(0, cm.index) + newTag + out.slice(cm.index + cm[0].length);
        report.repairs.push(`Promoted class-matched element to data-page="${pageId}" wrapper`);
      } else {
        stillMissing.push(pageId);
      }
    }
  }

  // ── 3. Inject fallback pages for anything still missing ──────────────────────
  for (const pageId of stillMissing) {
    const isFirst = requestedPageIds[0] === pageId;
    const activeClass = isFirst ? " active" : "";
    const innerContent = getFallbackContent(pageId, businessName, accentColor);
    const wrapper = `<div data-page="${pageId}" id="${pageId}" class="page-section${activeClass}">${innerContent}</div>`;
    out = out.replace("</body>", wrapper + "\n</body>");
    report.missingPagesAdded.push(pageId);
    report.repairs.push(`Injected fallback page wrapper for data-page="${pageId}"`);
    console.log(`[ensureMultiPage] Injected fallback for "${pageId}"`);
  }

  // ── 4. Remove inline display:none / display:block from data-page wrappers ────
  //    The CSS rule [data-page]{display:none!important}[data-page].active{display:block!important}
  //    is the sole authority — inline styles fight it and cause blank pages.
  out = out.replace(/(<(?:div|section|article|main)[^>]*\bdata-page=["'][^"']+["'][^>]*)(\bstyle="([^"]*)")([^>]*>)/gi,
    (_m, before, _styleAttr, styleContent, after) => {
      const cleaned = styleContent
        .replace(/\bdisplay\s*:\s*(none|block|flex|grid)\s*;?/gi, "")
        .replace(/^\s*;\s*/, "")
        .trim();
      const newStyle = cleaned ? ` style="${cleaned}"` : "";
      report.repairs.push("Removed inline display from data-page wrapper");
      return before + newStyle + after;
    }
  );

  // ── 5. Ensure exactly one 'active' class — activate the first requested page ─
  const activePages = [...out.matchAll(/data-page=["']([^"']+)["'][^>]*class="[^"]*\bactive\b/g)].map(m => m[1]);
  const activeFromClass = [...out.matchAll(/class="[^"]*\bactive\b[^"]*"[^>]*data-page=["']([^"']+)["']/g)].map(m => m[1]);
  const allActive = [...new Set([...activePages, ...activeFromClass])];

  if (allActive.length === 0) {
    // No active wrapper — activate the first requested page
    const firstId = requestedPageIds[0];
    const dpRe = new RegExp(`(data-page=["']${firstId}["'][^>]*class=")([^"]*)(")`);
    if (dpRe.test(out)) {
      out = out.replace(dpRe, (_m, pre, cls, post) => pre + cls.replace(/\bactive\b/, "").trim() + " active" + post);
    } else {
      // Try other attribute order
      const dpRe2 = new RegExp(`(class=")([^"]*)"([^>]*data-page=["']${firstId}["'])`);
      if (dpRe2.test(out)) {
        out = out.replace(dpRe2, (_m, pre, cls, rest) => pre + cls.replace(/\bactive\b/, "").trim() + " active\"" + rest);
      } else {
        // Brute force: add active to the first occurrence of data-page="firstId"
        out = out.replace(
          new RegExp(`(<(?:div|section|article|main)[^>]*data-page=["']${firstId}["'][^>]*class=")([^"]*)`),
          (_m, pre, cls) => pre + cls.replace(/\bactive\b/g, "").trim() + " active"
        );
      }
    }
    report.repairs.push(`Activated first page: data-page="${firstId}"`);
    console.log(`[ensureMultiPage] Activated first page: "${firstId}"`);
  } else if (allActive.length > 1) {
    // Multiple active wrappers — keep only the first requested one, deactivate others
    const keepActive = requestedPageIds.find(id => allActive.includes(id)) || allActive[0];
    for (const activeId of allActive) {
      if (activeId === keepActive) continue;
      out = out.replace(
        new RegExp(`(data-page=["']${activeId}["'][^>]*class=")([^"]*active[^"]*)(")`),
        (_m, pre, cls, post) => pre + cls.replace(/\bactive\b/g, "").replace(/\s+/g, " ").trim() + post
      );
      report.repairs.push(`Removed spurious 'active' from data-page="${activeId}"`);
    }
  }

  // ── 6. Fix nav link targets that don't match requestedPageIds ────────────────
  const validIds = new Set(requestedPageIds);
  out = out.replace(/navigateTo\(['"]([^'"]+)['"]\)/g, (m, target) => {
    if (validIds.has(target)) return m;
    // Try to find the closest matching page id
    const lower = target.toLowerCase();
    const matched = requestedPageIds.find(id =>
      id.includes(lower) || lower.includes(id) || id.startsWith(lower.slice(0, 4))
    );
    if (matched) {
      report.navTargetsFixed.push(`navigateTo('${target}') → navigateTo('${matched}')`);
      return `navigateTo('${matched}')`;
    }
    // Default to home
    report.navTargetsFixed.push(`navigateTo('${target}') → navigateTo('home') [no match]`);
    return `navigateTo('home')`;
  });

  // ── 7. Ensure required semantic IDs inside their page wrappers ───────────────
  // 7a. id="contact" inside contact page
  if (requestedPageIds.includes("contact") && out.includes('data-page="contact"') && !out.includes('id="contact"')) {
    // Add id="contact" to the h2 or first div inside the contact page
    const contactPageRe = /(<(?:div|section)[^>]*data-page="contact"[^>]*>)([\s\S]{0,5000}?)(<h2)/i;
    if (contactPageRe.test(out)) {
      out = out.replace(contactPageRe, (_m, open, body, h2) => open + body + h2.replace("<h2", '<h2 id="contact"'));
      report.repairs.push('Added id="contact" to h2 inside contact page');
    }
  }

  // 7b. id="faq" inside faq page
  if (requestedPageIds.includes("faq") && out.includes('data-page="faq"') && !out.includes('id="faq"')) {
    const faqPageRe = /(<(?:div|section)[^>]*data-page="faq"[^>]*>)([\s\S]{0,2000}?)(<h2)/i;
       if (faqPageRe.test(out)) {
      out = out.replace(faqPageRe, (_m: string, open: string, body: string, h2: string) => open + body + h2.replace('<h2', '<h2 id="faq"'));
      report.repairs.push('Added id="faq" to h2 inside faq page');
    }
  }

  // 7c. id="hero" inside home page
  if (requestedPageIds.includes('home') && out.includes('data-page="home"') && !out.includes('id="hero"')) {
    const heroRe = /(<(?:div|section)[^>]*data-page="home"[^>]*>)([\s\S]{0,1000}?)(<(?:section|div)[^>]*(?:class="[^"]*hero|min-height))/i;
    if (heroRe.test(out)) {
      out = out.replace(heroRe, (_m: string, dpOpen: string, body: string, heroTag: string) => {
        const newHeroTag = /id=/.test(heroTag) ? heroTag : heroTag.replace(/<((?:section|div)[^>]*)>$/, '<$1 id="hero">');
        return dpOpen + body + newHeroTag;
      });
      report.repairs.push('Added id="hero" to hero section inside home page');
    }
  }

  // 8. Booking page guard
  if (!hasBooking && !requestedPageIds.includes('booking')) {
    const bookingDpCount = (out.match(/data-page="booking"/g) || []).length;
    if (bookingDpCount > 0) {
      out = out.replace(/\s*data-page="booking"/g, '');
      report.repairs.push(`Removed ${bookingDpCount} stray data-page="booking" attribute(s) (booking not requested)`);
      console.log(`[ensureMultiPage] Removed ${bookingDpCount} stray data-page="booking" attributes`);
    }
  }

  console.log(`[ensureMultiPage] Done. Repairs: ${report.repairs.length}, Added pages: [${report.missingPagesAdded.join(',')}], Nav fixes: ${report.navTargetsFixed.length}`);
  return { html: out, report };
}
export function injectEssentials(html: string, email: string, phone: string, jobId?: string, ga4Id?: string, tawktoPropertyId?: string): string {
  let processed = html;

  if (email) {
    processed = processed.replace(/hello@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/support@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
    processed = processed.replace(/admin@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  }
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, "");
    processed = processed.replace(/\+1 \(555\)[^\s<"']*/g, phone);
    processed = processed.replace(/\(555\)[^\s<"']*/g, phone);
    processed = processed.replace(/555-[0-9-]+/g, phone);
    // Only replace AU mobile numbers that aren't already the real number
    processed = processed.replace(/\b(0[0-9]{3}\s?[0-9]{3}\s?[0-9]{3,4})\b/g, (m: string) => {
      if (m.replace(/\D/g, "") === phoneDigits) return m;
      return m; // leave unknown numbers — Step 5 already replaced fakes
    });
  }

  const script = `
<script>
(function() {
// ── Fix navigateTo targets — Stitch often wires all nav links to 'home' ──────
(function() {
  var labelMap = {
    "home": "home", "about": "about", "about us": "about",
    "services": "services", "our services": "services",
    "booking": "booking", "book": "booking", "book now": "booking",
    "appointments": "booking", "schedule": "booking",
    "contact": "contact", "contact us": "contact", "get in touch": "contact",
    "faq": "faq", "faqs": "faq", "frequently asked": "faq",
    "testimonials": "testimonials", "reviews": "testimonials",
    "gallery": "gallery", "portfolio": "gallery",
    "pricing": "pricing", "plans": "pricing",
    "blog": "blog", "news": "blog",
  };
  document.querySelectorAll("a[onclick*='navigateTo'], button[onclick*='navigateTo']").forEach(function(el) {
    var txt = (el.textContent || "").trim().toLowerCase();
    var target = labelMap[txt];
    if (!target) return;
    var oc = el.getAttribute("onclick") || "";
    // Only fix if current target is wrong (e.g. 'home' when text says 'booking')
    var currentTarget = (oc.match(/navigateTo\\(['"](\\w+)['"]\\)/) || [])[1];
    if (currentTarget && currentTarget !== target) {
      el.setAttribute("onclick", oc.replace(/navigateTo\\(['"](\\w+)['"]\\)/, "navigateTo('" + target + "')"));
    }
  });
})();
// Authoritative navigateTo — always defined here, Stitch version stripped in Step 5.
// Handles multi-page (.active class toggling) and single-page (scroll to id).
window.navigateTo = function(pageId) {
  // Close any open mobile drawer first
  var drawer = document.getElementById("mobile-menu") || document.getElementById("mobile-drawer") || document.getElementById("side-drawer") || document.getElementById("mobile-nav") || document.getElementById("wg-drawer");
  if (drawer) {
    drawer.classList.remove("translate-x-0");
    drawer.classList.add("translate-x-full", "hidden");
    drawer.style.display = "none";
    drawer.style.transform = "translateX(100%)";
  }
  var overlay = document.getElementById("wg-overlay");
  if (overlay) overlay.style.display = "none";

  // Multi-page: [data-page] is the sole authority — no .page-section fallback.
  var sections = document.querySelectorAll("[data-page]");
  if (sections.length > 1) {
    sections.forEach(function(s) { s.classList.remove("active"); });
    var target = document.querySelector("[data-page='" + pageId + "']") || document.getElementById(pageId);
    if (target) {
      target.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  // Single-page: scroll to section by id
  if (pageId === "home" || pageId === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  var el = document.getElementById(pageId);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  else { window.scrollTo({ top: 0, behavior: "smooth" }); }
};
document.querySelectorAll("a,button").forEach(function(el) {
  var oc = el.getAttribute("onclick") || "", hr = el.getAttribute("href") || "", dn = el.getAttribute("data-nav") || "", dp = el.getAttribute("data-page") || "";
  if (oc.includes("navigateTo")) return;
  if (dn) { el.addEventListener("click", function(e) { e.preventDefault(); window.navigateTo(dn); }); return; }
  if (dp) { el.addEventListener("click", function(e) { e.preventDefault(); window.navigateTo(dp); }); return; }
  if (hr.startsWith("#") && hr.length > 1) { el.addEventListener("click", function(e) { var t = document.querySelector(hr); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); } }); }
});
// Hamburger — catches id="hamburger", id="menu-toggle", class*=hamburger, aria-label patterns
document.querySelectorAll("#hamburger,#hamburger-btn,#menu-toggle,[class*='hamburger'],[aria-label='Open menu'],[aria-label='Menu'],[aria-label='Toggle menu']").forEach(function(btn) {
  if (btn.getAttribute("onclick")) return;
  btn.addEventListener("click", function() {
    // Find the drawer/menu — catches id="side-drawer", id="mobile-menu", id="mobile-nav", class patterns
    var drawer = document.getElementById("side-drawer") || document.getElementById("mobile-menu") || document.getElementById("mobile-nav") || document.querySelector("[class*='side-drawer'],[class*='mobile-menu'],[class*='mobile-nav']");
    if (!drawer) return;
    var isOpen = drawer.style.transform === "translateX(0px)" || drawer.style.transform === "translateX(0)" || !drawer.classList.contains("translate-x-full") && drawer.getBoundingClientRect().right > 0 && drawer.getBoundingClientRect().left < window.innerWidth;
    // For Tailwind translate-based drawers (translate-x-full = closed)
    if (drawer.classList.contains("translate-x-full") || drawer.style.transform === "translateX(100%)") {
      drawer.classList.remove("translate-x-full"); drawer.classList.add("translate-x-0"); drawer.style.transform = "translateX(0)";
    } else if (drawer.classList.contains("translate-x-0") || drawer.style.transform === "translateX(0px)" || drawer.style.transform === "translateX(0)") {
      drawer.classList.remove("translate-x-0"); drawer.classList.add("translate-x-full"); drawer.style.transform = "translateX(100%)";
    } else {
      // Fallback: toggle display
      var h = getComputedStyle(drawer).display === "none";
      drawer.style.display = h ? "flex" : "none";
    }
  });
});
// Close drawer button
document.querySelectorAll("#close-drawer,#close-menu,#menu-close,#nav-close,[aria-label='Close menu'],[aria-label='Close'],[aria-label='Close navigation']").forEach(function(btn) {
  btn.addEventListener("click", function() {
    var drawer = document.getElementById("side-drawer") || document.getElementById("mobile-menu") || document.getElementById("mobile-nav") || document.querySelector("[class*='side-drawer'],[class*='mobile-menu'],[class*='mobile-nav']");
    if (drawer) { drawer.classList.remove("translate-x-0"); drawer.classList.add("translate-x-full"); drawer.style.transform = "translateX(100%)"; drawer.style.display = "none"; }
  });
});
// Fallback: Stitch-generated buttons with data-icon="menu" (Material Icons pattern)
(function() {
  function wgToggleDrawer(forceClose) {
    var drawer = document.getElementById("side-drawer") || document.getElementById("mobile-menu") || document.getElementById("mobile-nav") || document.querySelector("[class*='side-drawer'],[class*='mobile-menu'],[class*='mobile-nav'],[class*='nav-drawer']");
    if (!drawer) return;
    var isOpen = drawer.style.transform === "translateX(0px)" || drawer.style.transform === "translateX(0)" || drawer.style.display === "flex" || drawer.style.display === "block";
    if (forceClose || isOpen) {
      drawer.classList.remove("translate-x-0"); drawer.classList.add("translate-x-full"); drawer.style.transform = "translateX(100%)"; drawer.style.display = "none";
    } else {
      drawer.classList.remove("translate-x-full"); drawer.classList.add("translate-x-0"); drawer.style.transform = "translateX(0)"; drawer.style.display = "flex";
    }
  }
  document.querySelectorAll("button,a").forEach(function(btn) {
    if (btn.getAttribute("data-wg-wired")) return;
    var ic = btn.querySelector("[data-icon='menu'],[data-icon='menu_open']");
    var txt = (btn.textContent || "").trim().toLowerCase();
    if (ic || txt === "menu") {
      btn.setAttribute("data-wg-wired", "1");
      btn.addEventListener("click", function(e) { e.stopPropagation(); wgToggleDrawer(); });
    }
  });
  // Wire data-icon="close" inside drawers
  document.querySelectorAll("[class*='side-drawer'],[class*='mobile-menu'],[class*='mobile-nav'],[class*='nav-drawer']").forEach(function(drawer) {
    drawer.querySelectorAll("button,a").forEach(function(btn) {
      if (btn.getAttribute("data-wg-wired")) return;
      var ic = btn.querySelector("[data-icon='close']");
      if (ic) { btn.setAttribute("data-wg-wired", "1"); btn.addEventListener("click", function() { wgToggleDrawer(true); }); }
    });
  });
  // If no drawer exists at all, inject one using the nav links already on the page
  var existingDrawer = document.getElementById("side-drawer") || document.getElementById("mobile-menu") || document.getElementById("mobile-nav") || document.querySelector("[class*='side-drawer'],[class*='mobile-menu'],[class*='mobile-nav']");
  if (!existingDrawer) {
    var nav = document.querySelector("header nav, nav");
    var links = nav ? Array.from(nav.querySelectorAll("a")).map(function(a) {
      return '<a href="' + (a.getAttribute("href") || "#") + '" onclick="' + (a.getAttribute("onclick") || "") + ';document.getElementById(\'wg-drawer\').style.display=\'none\';document.getElementById(\'wg-overlay\').style.display=\'none\';" style="display:block;padding:13px 16px;border-bottom:1px solid #f1f5f9;color:#111;font-weight:600;font-size:15px;text-decoration:none;">' + a.textContent.trim() + '</a>';
    }).join("") : "";
    var drawer = document.createElement("div");
    drawer.id = "wg-drawer";
    drawer.setAttribute("style", "display:none;position:fixed;top:0;right:0;width:80%;max-width:300px;height:100vh;background:#fff;z-index:9999;box-shadow:-4px 0 24px rgba(0,0,0,0.18);flex-direction:column;padding:20px;overflow-y:auto;");
    drawer.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><span style="font-weight:800;font-size:16px;">Menu</span><button onclick="document.getElementById(\'wg-drawer\').style.display=\'none\';document.getElementById(\'wg-overlay\').style.display=\'none\';" style="background:none;border:none;font-size:26px;cursor:pointer;line-height:1;color:#666;">×</button></div>' + links;
    var overlay = document.createElement("div");
    overlay.id = "wg-overlay";
    overlay.setAttribute("style", "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;");
    overlay.onclick = function() { drawer.style.display = "none"; overlay.style.display = "none"; };
    document.body.appendChild(drawer);
    document.body.appendChild(overlay);
    // Re-wire hamburger to this new drawer
    document.querySelectorAll("button,a").forEach(function(btn) {
      if (btn.getAttribute("data-wg-wired")) return;
      var ic = btn.querySelector("[data-icon='menu'],[data-icon='menu_open']");
      var txt = (btn.textContent || "").trim().toLowerCase();
      if (ic || txt === "menu" || btn.id === "hamburger") {
        btn.setAttribute("data-wg-wired", "1");
        btn.addEventListener("click", function(e) { e.stopPropagation(); drawer.style.display = "flex"; overlay.style.display = "block"; });
      }
    });
  }
})();
// Newsletter popup / modal close — catches any floating popup with a close button
// Stitch generates these with no onclick — we wire them up here
(function() {
  function closePopup(popup) {
    popup.style.display = "none";
    popup.style.opacity = "0";
    popup.style.visibility = "hidden";
    popup.style.pointerEvents = "none";
  }
  // Find all fixed/absolute positioned containers that look like popups
  var popups = document.querySelectorAll("[class*='popup'],[class*='modal'],[id*='popup'],[id*='modal'],[class*='newsletter'],[id*='newsletter'],[class*='promo'],[id*='promo'],[class*='offer'],[id*='offer']");
  popups.forEach(function(popup) {
    // Wire up any close/dismiss button inside the popup
    var closeBtns = popup.querySelectorAll("button,[aria-label*='close' i],[aria-label*='dismiss' i],[class*='close'],[id*='close'],[class*='dismiss']");
    closeBtns.forEach(function(btn) {
      if (btn.getAttribute("data-wg-popup-wired")) return;
      btn.setAttribute("data-wg-popup-wired", "1");
      btn.addEventListener("click", function(e) { e.stopPropagation(); closePopup(popup); });
    });
    // Also wire ✕ / × / x text-only buttons inside the popup
    popup.querySelectorAll("button,span,div").forEach(function(el) {
      if (el.getAttribute("data-wg-popup-wired")) return;
      var txt = (el.textContent || "").trim();
      if (txt === "×" || txt === "✕" || txt === "✖" || txt === "x" || txt === "X" || txt === "close" || txt === "Close") {
        el.setAttribute("data-wg-popup-wired", "1");
        el.style.cursor = "pointer";
        el.addEventListener("click", function(e) { e.stopPropagation(); closePopup(popup); });
      }
    });
  });
  // Also handle the newsletter form submission — close popup on submit
  document.querySelectorAll("form").forEach(function(form) {
    var popup = form.closest("[class*='popup'],[class*='modal'],[id*='popup'],[id*='modal'],[class*='newsletter'],[id*='newsletter'],[class*='promo'],[id*='promo'],[class*='offer'],[id*='offer']");
    if (!popup) return;
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      var emailInput = form.querySelector("input[type='email'],input[type='text']");
      var email = emailInput ? emailInput.value.trim() : "";
      var btn = form.querySelector("button[type='submit'],button");
      if (btn) { btn.textContent = "Subscribed!"; btn.style.background = "#22c55e"; }
      setTimeout(function() { closePopup(popup); }, 1200);
    });
  });
})();
document.querySelectorAll("details").forEach(function(d) {
  var s = d.querySelector("summary");
  if (s) { s.style.cursor = "pointer"; s.addEventListener("click", function(e) { e.preventDefault(); var o = d.hasAttribute("open"); document.querySelectorAll("details").forEach(function(x) { x.removeAttribute("open"); }); if (!o) d.setAttribute("open", ""); }); }
});
document.querySelectorAll("[class*='faq'],[class*='accordion'],[id*='faq']").forEach(function(c) {
  c.querySelectorAll("[class*='item'],[class*='question'],[class*='entry']").forEach(function(item) {
    var q = item.querySelector("[class*='question'],[class*='trigger'],h3,h4,button");
    var a = item.querySelector("[class*='answer'],[class*='content'],p");
    if (q && a) { a.style.display = "none"; q.style.cursor = "pointer"; q.addEventListener("click", function() { var o = a.style.display !== "none"; c.querySelectorAll("[class*='answer'],[class*='content'],p").forEach(function(x) { x.style.display = "none"; }); if (!o) a.style.display = "block"; }); }
  });
});
var cart = [];
function showToast(msg) { var t = document.getElementById("wg-toast"); if (!t) { t = document.createElement("div"); t.id = "wg-toast"; t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:99999;transition:opacity 0.3s;pointer-events:none;"; document.body.appendChild(t); } t.textContent = msg; t.style.opacity = "1"; setTimeout(function() { t.style.opacity = "0"; }, 2500); }
document.querySelectorAll("button,a").forEach(function(btn) { var txt = (btn.textContent || "").toLowerCase().trim(); if (txt.includes("add to cart") || txt.includes("buy now") || txt.includes("add to bag")) { btn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); var card = this.closest("article") || this.closest("[class*='product']") || this.parentElement; var nm = card && card.querySelector("h1,h2,h3,h4"); var n = nm ? nm.textContent.trim() : "Item"; var ex = cart.find(function(i) { return i.name === n; }); if (ex) ex.qty++; else cart.push({ name: n, qty: 1 }); showToast(n + " added"); var total = cart.reduce(function(a, b) { return a + b.qty; }, 0); document.querySelectorAll("#cart-count,#cart-badge,[class*='cart-count']").forEach(function(b) { b.textContent = total; }); }); } });
document.querySelectorAll("form").forEach(function(form) {
  // Skip forms inside the booking widget — it manages its own fetch-based submit
  if (form.closest("#booking") || form.closest(".bw-container") || form.id === "bw-form") return;
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    if (form.querySelector(".wg-success")) return;
    var s = document.createElement("div"); s.className = "wg-success";
    s.style.cssText = "background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;font-family:sans-serif;";
    s.textContent = "Thank you! We will be in touch within 24 hours.";
    form.appendChild(s);
    form.querySelectorAll("input,textarea,select,button[type='submit']").forEach(function(el) { el.setAttribute("disabled", "true"); });
  });
});
// Multi-page init: only fires when [data-page] wrappers exist. Never touches .page-section.
(function() {
  var pages = document.querySelectorAll("[data-page]");
  if (pages.length < 2) return;
  if (!document.querySelector("style[data-wg-mp]")) {
    var s = document.createElement("style");
    s.setAttribute("data-wg-mp", "1");
    s.textContent = "[data-page]{display:none!important}[data-page].active{display:block!important}";
    document.head.appendChild(s);
  }
  var active = document.querySelector("[data-page].active") || pages[0];
  pages.forEach(function(p) { p.classList.remove("active"); });
  active.classList.add("active");
  console.log("[WG] Multi-page init: activated", active.getAttribute("data-page") || active.id, "of", pages.length);
})()
})();
</script>`;

  // WebGecko analytics tracker
  const wgApiBase = (process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au") + "/api/analytics/track";
  const trackerScript = jobId ? [
    '<script>',
    '(function(){',
    '  var WG_JOB="' + jobId + '";',
    '  var WG_API="' + wgApiBase + '";',
    '  function wgTrack(event,page){try{fetch(WG_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:WG_JOB,event:event,page:page||window.location.pathname})});}catch(e){}}',
    '  wgTrack("page_view",document.title||window.location.pathname);',
    '  document.addEventListener("click",function(e){',
    '    var el=e.target.closest("a,button");',
    '    if(!el)return;',
    '    var txt=(el.textContent||"").toLowerCase();',
    '    var href=el.getAttribute("href")||"";',
    '    var oc=el.getAttribute("onclick")||"";',
    '    if(txt.includes("book")||oc.includes("booking")||href.includes("booking")){wgTrack("booking_click");}',
    '    else if(txt.includes("contact")||oc.includes("contact")||href.includes("contact")){wgTrack("contact_click");}',
    '  });',
    '  document.addEventListener("submit",function(e){wgTrack("form_submit");});',
    '})();',
    '</script>',
  ].join("\n") : "";

  // GA4 tag
  const ga4Script = ga4Id ? `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${ga4Id}');
</script>` : "";

  // Inject GA4 into <head> if possible
  if (ga4Script && processed.includes("</head>")) {
    processed = processed.replace("</head>", ga4Script + "\n</head>");
  }

  // Tawk.to live chat widget
  const tawktoScript = tawktoPropertyId ? `
<!--Start of Tawk.to Script-->
<script type="text/javascript">
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/${tawktoPropertyId}/default';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();
</script>
<!--End of Tawk.to Script-->` : "";

  const allScripts = script + trackerScript + tawktoScript;
  if (processed.includes("</body>")) return processed.replace("</body>", allScripts + "</body>");
  return processed + allScripts;
}

// ─── injectImages ─────────────────────────────────────────────────────────────
// Full version from original worker — DOM-based smart injection via script tag

export function injectImages(
  html: string,
  logoUrl: string | null,
  heroUrl: string | null,
  photoUrls: string[],
  products: { name: string; price: string; photoUrl?: string }[]
): string {
  const processed = html;
  const script = `
<script>
(function() {
  ${logoUrl ? `
  var logoUrl = "${logoUrl}";
  var header = document.querySelector("header, nav, [class*='navbar'], [class*='nav']");
  if (header) {
    var existingLogo = header.querySelector("img");
    if (existingLogo) {
      existingLogo.src = logoUrl;
      existingLogo.style.height = "40px";
      existingLogo.style.width = "auto";
      existingLogo.style.objectFit = "contain";
    } else {
      var textLogo = header.querySelector("[class*='logo'],[class*='brand'],[class*='site-name']");
      if (textLogo) {
        var img = document.createElement("img");
        img.src = logoUrl;
        img.style.cssText = "height:40px;width:auto;object-fit:contain;";
        img.alt = "Logo";
        textLogo.innerHTML = "";
        textLogo.appendChild(img);
      }
    }
  }` : ""}
  ${heroUrl ? `
  var heroUrl = "${heroUrl}";
  var heroSection = document.querySelector("[class*='hero'],[id*='hero'],section:first-of-type");
  if (heroSection) {
    if (heroSection.style.backgroundImage) heroSection.style.backgroundImage = "url(" + heroUrl + ")";
    var heroImg = heroSection.querySelector("img");
    if (heroImg) { heroImg.src = heroUrl; heroImg.style.objectFit = "cover"; }
  }` : ""}
  ${products.filter(p => p.photoUrl).length > 0 ? `
  var productData = ${JSON.stringify(products.filter(p => p.photoUrl))};
  productData.forEach(function(product) {
    document.querySelectorAll("*").forEach(function(el) {
      if (el.children.length === 0 && el.textContent && el.textContent.toLowerCase().trim().includes(product.name.toLowerCase())) {
        var container = el.closest("li, article, [class*='card'], [class*='item'], div");
        if (container) {
          var img = container.querySelector("img");
          if (img && product.photoUrl) { img.src = product.photoUrl; img.style.objectFit = "cover"; }
        }
      }
    });
  });
  var productImgs = document.querySelectorAll("[class*='menu'] img, [class*='product'] img, [class*='item'] img, [id*='menu'] img, [class*='card'] img");
  var photoList = productData.map(function(p) { return p.photoUrl; });
  productImgs.forEach(function(img, i) { if (photoList[i]) { img.src = photoList[i]; img.style.objectFit = "cover"; } });` : ""}
  ${photoUrls.length > 0 ? `
  var generalPhotos = ${JSON.stringify(photoUrls)};
  var galleryImgs = document.querySelectorAll("[class*='gallery'] img, [id*='gallery'] img");
  galleryImgs.forEach(function(img, i) { if (generalPhotos[i]) img.src = generalPhotos[i]; });` : ""}
})();
</script>`;
  if (processed.includes("</body>")) return processed.replace("</body>", script + "</body>");
  return processed + script;
}

// ─── Booking system helpers ───────────────────────────────────────────────────

export const SLOT_DURATIONS: Record<string, number> = {
  medical: 30, health: 30, dental: 45, psychology: 50,
  legal: 60, accounting: 60, financial: 60,
  beauty: 45, hair: 45, spa: 60, fitness: 60,
  "personal training": 60, cleaning: 120,
  consulting: 60, coaching: 60, photography: 120,
  default: 60,
};

export function getSlotDuration(industry: string): number {
  const lower = industry.toLowerCase();
  for (const [key, val] of Object.entries(SLOT_DURATIONS)) {
    if (key !== "default" && lower.includes(key)) return val;
  }
  return SLOT_DURATIONS.default;
}

export function getServicesForIndustry(industry: string): { name: string; duration: number }[] {
  const lower = industry.toLowerCase();
  const dur = getSlotDuration(industry);
  if (lower.includes("beauty") || lower.includes("hair") || lower.includes("salon")) return [{ name: "Appointment", duration: dur }, { name: "Consultation", duration: 30 }];
  if (lower.includes("dental") || lower.includes("medical") || lower.includes("health")) return [{ name: "Initial Consultation", duration: dur }, { name: "Follow-up Appointment", duration: 30 }, { name: "General Appointment", duration: dur }];
  if (lower.includes("legal") || lower.includes("accounting") || lower.includes("financial")) return [{ name: "Initial Consultation", duration: dur }, { name: "Ongoing Appointment", duration: dur }];
  if (lower.includes("trade") || lower.includes("plumb") || lower.includes("electric") || lower.includes("clean")) return [{ name: "Initial Consultation", duration: dur }, { name: "Quote Visit", duration: 60 }, { name: "Service Appointment", duration: dur }];
  if (lower.includes("photo") || lower.includes("studio")) return [{ name: "Portrait Session", duration: dur }, { name: "Event Photography", duration: 120 }, { name: "Consultation", duration: 30 }];
  if (lower.includes("fitness") || lower.includes("training") || lower.includes("gym")) return [{ name: "Personal Training Session", duration: dur }, { name: "Initial Assessment", duration: 45 }];
  return [{ name: "Appointment", duration: dur }, { name: "Consultation", duration: 30 }];
}
