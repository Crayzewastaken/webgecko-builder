// lib/pipeline-helpers.ts
// Shared helpers used by both worker/route.ts (intake) and pipeline/run/route.ts (build)

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

export function calculateQuote(userInput: any) {
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

    // Strategy C: first unid'd page-section div in document order
    let injectedC = false;
    fixed = fixed.replace(/<div([^>]*class="[^"]*page-section[^"]*"[^>]*)>/g, (m, attrs) => {
      if (injectedC || attrs.includes("id=")) return m;
      injectedC = true;
      console.log(`Link Fix [C]: id="${pageId}" on page-section`);
      return `<div${attrs} id="${pageId}">`;
    });
    if (injectedC) continue;

    // Strategy D: inject a real styled section before </body>
    const sectionTemplates: Record<string, string> = {
      contact: `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:600px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:8px;">Contact Us</h2><p style="color:#94a3b8;margin-bottom:24px;">Get in touch and we will respond within 24 hours.</p><form style="display:flex;flex-direction:column;gap:16px;" onsubmit="event.preventDefault();this.innerHTML='<p style=color:#22c55e;font-weight:bold;font-size:1.1rem;>Thank you! We will be in touch shortly.</p>'"><input type="text" placeholder="Your Name" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><input type="email" placeholder="Your Email" required style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><input type="tel" placeholder="Your Phone" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;"/><textarea placeholder="Your Message" rows="5" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:14px;font-size:1rem;resize:vertical;"></textarea><button type="submit" style="background:#10b981;color:#fff;font-weight:700;padding:16px;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send Message</button></form></div></div>`,
      about: `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:16px;">About Us</h2><p style="color:#94a3b8;font-size:1.1rem;line-height:1.8;">We are a dedicated team committed to delivering exceptional results for our clients. With years of experience in the industry, we pride ourselves on quality, reliability, and customer satisfaction.</p></div></div>`,
      services: `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0a0f1a;"><div style="max-width:900px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Our Services</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px;"><div style="background:#1e293b;border-radius:12px;padding:28px;"><h3 style="color:#10b981;margin-bottom:8px;">Professional Service</h3><p style="color:#94a3b8;">High quality results delivered on time and on budget.</p></div></div></div></div>`,
      pricing: `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Pricing</h2><p style="color:#94a3b8;">Contact us for a custom quote tailored to your needs.</p></div></div>`,
      gallery: `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0a0f1a;"><div style="max-width:1000px;margin:0 auto;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:32px;">Gallery</h2><p style="color:#94a3b8;">Our portfolio of recent work.</p></div></div>`,
    };

    const templateKey = Object.keys(sectionTemplates).find(k => new RegExp(k, "i").test(pageId));
    const injectedHtml = templateKey
      ? sectionTemplates[templateKey]
      : `<div class="page-section" id="${pageId}" style="display:none;padding:80px 24px;background:#0f172a;"><div style="max-width:800px;margin:0 auto;text-align:center;"><h2 style="color:#f1f5f9;font-size:2rem;font-weight:900;margin-bottom:16px;">${pageId.charAt(0).toUpperCase() + pageId.slice(1)}</h2><p style="color:#94a3b8;">Content coming soon.</p></div></div>`;

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

// ─── injectEssentials ─────────────────────────────────────────────────────────
// Full version from original worker — includes navigateTo, hamburger, FAQ accordion,
// cart toast, form handler, multi-page init

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
window.navigateTo = function(pageId) {
  // Close any open mobile drawer/menu first
  var mm = document.getElementById("mobile-menu") || document.getElementById("mobile-nav") || document.getElementById("side-drawer");
  if (mm) { mm.classList.add("hidden"); mm.style.display = "none"; mm.classList.remove("translate-x-0"); mm.classList.add("translate-x-full"); }

  // Determine if this is a true multi-page site (elements with data-page attribute)
  var realPages = document.querySelectorAll("[data-page]");
  var isMultiPage = realPages.length > 1;

  if (isMultiPage) {
    // Multi-page: hide all pages, show target
    document.querySelectorAll("[data-page]").forEach(function(p) { p.style.display = "none"; p.classList.remove("active"); });
    var target = document.querySelector('[data-page="' + pageId + '"]') || document.getElementById(pageId);
    if (target) { target.style.display = "block"; target.classList.add("active"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }

  // Single-page: always scroll to target element. 'home' scrolls to top.
  if (pageId === "home" || pageId === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  var t = document.getElementById(pageId) || document.getElementById("page-" + pageId) || document.querySelector('[id*="' + pageId + '"]');
  if (t) { t.scrollIntoView({ behavior: "smooth", block: "start" }); }
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
// Multi-page init: ONLY activate hide/show for elements with explicit data-page attribute.
// NEVER hide .page-section elements — Stitch uses that class as pure visual styling on all sections.
var realPageWrappers = document.querySelectorAll("[data-page]");
if (realPageWrappers.length > 1) {
  var ha = false;
  realPageWrappers.forEach(function(p) { if (p.classList.contains("active") || p.style.display !== "none") ha = true; });
  if (!ha) {
    realPageWrappers.forEach(function(p, i) {
      if (i === 0) { p.style.display = "block"; p.classList.add("active"); }
      else { p.style.display = "none"; }
    });
  }
}
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
  let processed = html;
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
