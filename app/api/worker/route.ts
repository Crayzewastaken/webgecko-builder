export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

function safeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function extractCSS(html: string): string {
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    if (!match[1].includes('tailwind') && match[1].trim().length > 10) {
      styleBlocks.push(match[1].trim());
    }
  }
  const tailwindMatch = html.match(/tailwind\.config\s*=\s*({[\s\S]*?})\s*<\/script>/);
  let colorVars = '';
  if (tailwindMatch) {
    try {
      const config = eval('(' + tailwindMatch[1] + ')');
      const colors = config?.theme?.extend?.colors || {};
      const fonts = config?.theme?.extend?.fontFamily || {};
      colorVars = '/* ── THEME COLORS ── */\n:root {\n';
      Object.entries(colors).forEach(([key, val]) => {
        colorVars += `  --color-${key}: ${val};\n`;
      });
      colorVars += '}\n\n/* ── FONTS ── */\n';
      Object.entries(fonts).forEach(([key, val]) => {
        colorVars += `/* ${key}: ${Array.isArray(val) ? val.join(', ') : val} */\n`;
      });
    } catch (e) {
      colorVars = '/* Could not extract theme colors */\n';
    }
  }
  return `/* WebGecko Generated Styles — paste into WordPress Appearance > Additional CSS */\n\n${colorVars}\n/* ── CUSTOM STYLES ── */\n${styleBlocks.join('\n\n')}`;
}

function calculateQuote(userInput: any): { package: string; price: number; monthlyPrice: number; savings: number; breakdown: string[] } {
  const pageCount = Array.isArray(userInput.pages) ? userInput.pages.length : 1;
  const features = Array.isArray(userInput.features) ? userInput.features : [];
  const isMultiPage = userInput.siteType === 'multi';
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const hasBlog = features.includes('Blog');

  let packageName = 'Starter';
  let basePrice = 1800;
  let competitorPrice = 3500;
  const breakdown: string[] = [];

  if (pageCount >= 8 || hasEcommerce || hasBooking) {
    packageName = 'Premium';
    basePrice = 5500;
    competitorPrice = 15000;
  } else if (pageCount >= 4 || isMultiPage) {
    packageName = 'Business';
    basePrice = 3200;
    competitorPrice = 7500;
  }

  breakdown.push(`${packageName} package (${pageCount} pages): $${basePrice.toLocaleString()}`);

  let addons = 0;
  if (hasEcommerce && packageName !== 'Premium') { addons += 300; breakdown.push('Payments / Shop: +$300'); }
  if (hasBooking && packageName !== 'Premium') { addons += 200; breakdown.push('Booking system: +$200'); }
  if (hasBlog) { addons += 150; breakdown.push('Blog setup: +$150'); }
  if (features.includes('Photo Gallery')) { addons += 100; breakdown.push('Photo gallery: +$100'); }
  if (features.includes('Reviews & Testimonials')) { addons += 100; breakdown.push('Reviews & testimonials: +$100'); }
  if (features.includes('Live Chat')) { addons += 150; breakdown.push('Live chat: +$150'); }
  if (features.includes('Newsletter Signup')) { addons += 100; breakdown.push('Newsletter: +$100'); }

  const totalPrice = basePrice + addons;
  const monthlyPrice = packageName === 'Premium' ? 149 : packageName === 'Business' ? 99 : 79;
  const savings = competitorPrice - totalPrice;
  breakdown.push(`Monthly hosting & maintenance: $${monthlyPrice}/month`);

  return { package: packageName, price: totalPrice, monthlyPrice, savings, breakdown };
}

function injectEssentials(html: string, email: string, phone: string): string {
  let processed = html;
  processed = processed.replace(/hello@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/support@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
  processed = processed.replace(/\+1 \(555\)[^\s<"']*/g, phone);
  processed = processed.replace(/\(555\)[^\s<"']*/g, phone);
  processed = processed.replace(/555-[0-9-]+/g, phone);
  processed = processed.replace(/1-800-[^\s<"']*/g, phone);

  const script = `
<script>
(function() {

// ── PAGE NAVIGATION ──────────────────────────────────────
window.navigateTo = function(pageId) {
  document.querySelectorAll('.page, .page-section, [class*="page-section"]').forEach(function(p) {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  const target =
    document.getElementById(pageId) ||
    document.getElementById('page-' + pageId) ||
    document.querySelector('[data-page="' + pageId + '"]');
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const mobileMenu = document.getElementById('mobile-menu') || document.getElementById('mobile-nav');
  if (mobileMenu) { mobileMenu.classList.add('hidden'); mobileMenu.style.display = 'none'; }
};

// ── BIND NAV LINKS ───────────────────────────────────────
document.querySelectorAll('a, button').forEach(function(el) {
  const onclick = el.getAttribute('onclick') || '';
  const href = el.getAttribute('href') || '';
  const datanav = el.getAttribute('data-nav') || '';
  const datapage = el.getAttribute('data-page') || '';
  if (onclick.includes('navigateTo')) return;
  if (datanav) { el.addEventListener('click', function(e) { e.preventDefault(); window.navigateTo(datanav); }); return; }
  if (datapage) { el.addEventListener('click', function(e) { e.preventDefault(); window.navigateTo(datapage); }); return; }
  if (href.startsWith('#') && href.length > 1) {
    el.addEventListener('click', function(e) {
      const target = document.querySelector(href);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  }
});

// ── MOBILE HAMBURGER ─────────────────────────────────────
const hamburgers = document.querySelectorAll(
  '#hamburger,#hamburger-btn,#menu-btn,[class*="hamburger"],[aria-label="Open menu"],[aria-label="Menu"],[aria-label="Toggle menu"]'
);
const mobileMenus = document.querySelectorAll(
  '#mobile-menu,#mobile-nav,[class*="mobile-menu"],[class*="mobile-nav"]'
);
hamburgers.forEach(function(btn) {
  if (btn.getAttribute('onclick')) return;
  btn.addEventListener('click', function() {
    mobileMenus.forEach(function(menu) {
      const isHidden = menu.classList.contains('hidden') || menu.style.display === 'none' || getComputedStyle(menu).display === 'none';
      if (isHidden) { menu.classList.remove('hidden'); menu.style.display = 'flex'; menu.style.flexDirection = 'column'; }
      else { menu.classList.add('hidden'); menu.style.display = 'none'; }
    });
  });
});

// ── FAQ ACCORDION ────────────────────────────────────────
function initFAQ() {
  // Method 1: details/summary elements (native HTML accordion)
  document.querySelectorAll('details').forEach(function(details) {
    const summary = details.querySelector('summary');
    if (summary) {
      summary.style.cursor = 'pointer';
      summary.addEventListener('click', function(e) {
        e.preventDefault();
        const isOpen = details.hasAttribute('open');
        // Close all others
        document.querySelectorAll('details').forEach(function(d) { d.removeAttribute('open'); });
        if (!isOpen) details.setAttribute('open', '');
      });
    }
  });

  // Method 2: div-based FAQ with question/answer pattern
  const faqContainers = document.querySelectorAll(
    '[class*="faq"],[class*="accordion"],[class*="FAQ"],[id*="faq"],[id*="FAQ"]'
  );
  faqContainers.forEach(function(container) {
    const items = container.querySelectorAll(
      '[class*="item"],[class*="question"],[class*="entry"],[class*="row"]'
    );
    items.forEach(function(item) {
      const question = item.querySelector(
        '[class*="question"],[class*="trigger"],[class*="header"],[class*="title"],h3,h4,button'
      );
      const answer = item.querySelector(
        '[class*="answer"],[class*="content"],[class*="body"],[class*="panel"],p'
      );
      if (question && answer) {
        answer.style.display = 'none';
        question.style.cursor = 'pointer';
        question.addEventListener('click', function() {
          const isOpen = answer.style.display !== 'none';
          // Close all
          items.forEach(function(i) {
            const a = i.querySelector('[class*="answer"],[class*="content"],[class*="body"],[class*="panel"],p');
            if (a) a.style.display = 'none';
          });
          if (!isOpen) answer.style.display = 'block';
        });
      }
    });
  });

  // Method 3: group-open Tailwind pattern
  document.querySelectorAll('[class*="group"]').forEach(function(group) {
    const trigger = group.querySelector('button, [class*="question"], summary, h3, h4');
    const content = group.querySelector('[class*="answer"], [class*="content"], [class*="panel"]');
    if (trigger && content) {
      if (!content.classList.contains('wg-faq-init')) {
        content.classList.add('wg-faq-init');
        content.style.display = 'none';
        trigger.style.cursor = 'pointer';
        trigger.addEventListener('click', function() {
          const isOpen = content.style.display !== 'none';
          content.style.display = isOpen ? 'none' : 'block';
          // Toggle icon rotation if exists
          const icon = trigger.querySelector('[class*="rotate"],[class*="arrow"],[class*="chevron"],span');
          if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        });
      }
    }
  });
}
initFAQ();

// ── ADD TO CART ──────────────────────────────────────────
let cart = [];
function showToast(msg) {
  let toast = document.getElementById('wg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wg-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:99999;transition:opacity 0.3s;pointer-events:none;font-family:sans-serif;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function() { toast.style.opacity = '0'; }, 2500);
}
document.querySelectorAll('button, a').forEach(function(btn) {
  const txt = (btn.textContent || '').toLowerCase().trim();
  if (txt.includes('add to cart') || txt.includes('buy now') || txt.includes('add to bag') || txt.includes('purchase')) {
    btn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      const card = this.closest('article') || this.closest('[class*="product"]') || this.closest('[class*="card"]') || this.parentElement;
      const nameEl = card && card.querySelector('h1,h2,h3,h4,h5');
      const name = nameEl ? nameEl.textContent.trim() : 'Item';
      const priceEl = card && card.querySelector('[class*="price"],[class*="cost"]');
      const price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')) : 0;
      const existing = cart.find(function(i) { return i.name === name; });
      if (existing) existing.qty++;
      else cart.push({ name: name, price: price, qty: 1 });
      showToast(name + ' added to cart \u2713');
      const total = cart.reduce(function(a,b) { return a + b.qty; }, 0);
      document.querySelectorAll('#cart-count,#cart-badge,[class*="cart-count"]').forEach(function(badge) { badge.textContent = total; });
    });
  }
});

// ── FORMS ────────────────────────────────────────────────
document.querySelectorAll('form').forEach(function(form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (form.querySelector('.wg-success')) return;
    const success = document.createElement('div');
    success.className = 'wg-success';
    success.style.cssText = 'background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;font-size:16px;font-family:sans-serif;';
    success.textContent = '\u2713 Thank you! We will be in touch within 24 hours.';
    form.appendChild(success);
    form.querySelectorAll('input,textarea,select,button[type="submit"]').forEach(function(el) { el.setAttribute('disabled','true'); });
  });
});

// ── INIT MULTI-PAGE ──────────────────────────────────────
const allPages = document.querySelectorAll('.page, .page-section');
if (allPages.length > 1) {
  let hasActive = false;
  allPages.forEach(function(p) { if (p.classList.contains('active')) hasActive = true; });
  if (!hasActive) {
    allPages.forEach(function(p, i) {
      if (i === 0) { p.style.display = 'block'; p.classList.add('active'); }
      else { p.style.display = 'none'; }
    });
  }
}

})();
</script>`;

  if (processed.includes('</body>')) return processed.replace('</body>', script + '</body>');
  return processed + script;
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";
    const isMultiPage = userInput.siteType === "multi";
    const fileName = safeFileName(userInput.businessName || "website");
    const clientEmail = userInput.email || "";
    const clientPhone = userInput.phone || "";
    const quote = calculateQuote(userInput);

    console.log("STEP 1: Claude spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON with "projectTitle" and "stitchPrompt".

Business: ${userInput.businessName}
Industry: ${userInput.industry}
USP: ${userInput.usp}
Goal: ${userInput.goal}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}
Contact Email: ${clientEmail}
Contact Phone: ${clientPhone}

${isMultiPage ? `
MULTI-PAGE SITE REQUIRED. Pages: ${pageList}
- A div for each page with class "page-section" and unique id in lowercase
- Only first page visible, others hidden with style="display:none"
- Nav links using onclick="navigateTo('pageid')"
- Mobile hamburger with id="hamburger" toggling id="mobile-menu"
- On the contact page use REAL email: ${clientEmail} and REAL phone: ${clientPhone}
- FAQ section must use native HTML details/summary elements for accordion dropdowns
` : `
SINGLE PAGE SITE REQUIRED. Sections: ${pageList}
- Each section with unique id in lowercase
- Nav links using href="#sectionid"
- Mobile hamburger with id="hamburger" toggling id="mobile-menu"
- In contact section use REAL email: ${clientEmail} and REAL phone: ${clientPhone}
- FAQ section must use native HTML details/summary elements for accordion dropdowns
`}

Make it premium and visually stunning for: ${userInput.businessName} — ${userInput.industry}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    console.log("STEP 2: Creating project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    console.log("STEP 3: Generating screen...");
    const stitchResult: any = await stitchClient.callTool("generate_screen_from_text", {
      projectId,
      prompt: spec.stitchPrompt,
    });

    const screens = stitchResult?.outputComponents?.find((x: any) => x.design)?.design?.screens || [];
    if (!screens.length) throw new Error("No screens returned");
    const downloadUrl = screens[0]?.htmlCode?.downloadUrl;
    if (!downloadUrl) throw new Error("No downloadUrl");
    console.log("STEP 3 DONE");

    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    const finalHtml = injectEssentials(stitchHtml, clientEmail, clientPhone);
    const cssContent = extractCSS(stitchHtml);
    console.log("STEP 5: JS injected + CSS extracted");

    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, {
      html: finalHtml,
      title: spec.projectTitle,
      fileName,
      userInput,
    }, { ex: 86400 });

    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/process?id=${jobId}&secret=${process.env.PROCESS_SECRET}`;

    console.log("STEP 6: Emailing owner...");
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `New Request - ${spec.projectTitle}`,
      html: `
        <h2>New Website Request</h2>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Client:</strong> ${userInput.name}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Site Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</p>
        <p><strong>Style:</strong> ${userInput.style}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <br/>
        <h3>💰 Quote</h3>
        <p><strong>Package:</strong> ${quote.package}</p>
        <p><strong>Total:</strong> $${quote.price.toLocaleString()}</p>
        <p><strong>Monthly:</strong> $${quote.monthlyPrice}/month</p>
        <ul>${quote.breakdown.map(b => `<li>${b}</li>`).join('')}</ul>
        <br/>
        <p>HTML + CSS attached. Click below for Claude deep fix if needed:</p>
        <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">✅ Fix This Site</a>
        <p style="color:#94a3b8;font-size:12px;">Link expires in 24 hours.</p>
      `,
      attachments: [
        { filename: `${fileName}.html`, content: Buffer.from(finalHtml).toString("base64") },
        { filename: `${fileName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
      ],
    });
    console.log("STEP 6 DONE");

    if (clientEmail) {
      console.log("STEP 7: Emailing client...");
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: clientEmail,
        subject: `We've received your website request!`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
            <h1 style="font-size:28px;margin-bottom:8px;">Thank you, ${userInput.name}!</h1>
            <p style="color:#666;margin-bottom:32px;">We have received your website request and our team is reviewing it now.</p>
            <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:16px;margin-bottom:16px;color:#333;">Your Request Summary</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#666;width:140px;">Business</td><td style="padding:8px 0;font-weight:600;">${userInput.businessName}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Industry</td><td style="padding:8px 0;font-weight:600;">${userInput.industry}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Goal</td><td style="padding:8px 0;font-weight:600;">${userInput.goal}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Site Type</td><td style="padding:8px 0;font-weight:600;">${userInput.siteType === "multi" ? "Multi Page" : "Single Page"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Pages</td><td style="padding:8px 0;font-weight:600;">${pageList}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Features</td><td style="padding:8px 0;font-weight:600;">${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Style</td><td style="padding:8px 0;font-weight:600;">${userInput.style || "-"}</td></tr>
              </table>
            </div>
            <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;color:white;">
              <h2 style="font-size:16px;margin-bottom:16px;color:#f2ca50;">💰 Your Quote — ${quote.package} Package</h2>
              <p style="font-size:32px;font-weight:800;margin:0;color:white;">$${quote.price.toLocaleString()}</p>
              <p style="color:#94a3b8;margin-bottom:16px;">+ $${quote.monthlyPrice}/month hosting & maintenance</p>
              <div style="border-top:1px solid #ffffff20;padding-top:16px;">
                ${quote.breakdown.map(b => `<p style="margin:4px 0;color:#cbd5e1;font-size:14px;">✓ ${b}</p>`).join('')}
              </div>
              <div style="background:#22c55e20;border:1px solid #22c55e40;border-radius:8px;padding:16px;margin-top:16px;">
                <p style="color:#22c55e;font-weight:bold;margin:0;font-size:18px;">🎉 You are saving $${quote.savings.toLocaleString()} compared to the industry average!</p>
              </div>
            </div>
            <p style="color:#666;">Our team will be in touch within <strong>24 hours</strong> with your website preview.</p>
            <p style="color:#666;">Reply to this email if you have any questions.</p>
            <br/>
            <div style="border-top:1px solid #eee;padding-top:20px;margin-top:20px;">
              <p style="color:#999;font-size:12px;">WebGecko — Professional Web Design</p>
              <p style="color:#999;font-size:12px;">webgecko.au</p>
            </div>
          </div>
        `,
      });
      console.log("STEP 7 DONE");
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! We have received your request and will be in touch shortly.",
    });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}