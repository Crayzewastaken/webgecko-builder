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

function injectEssentials(html: string): string {
  const script = `
<script>
(function() {

// ── PAGE NAVIGATION ──────────────────────────────────────
window.navigateTo = function(pageId) {
  // Hide all possible page containers
  document.querySelectorAll(
    '.page, .page-section, [class*="page-section"], [data-page-id]'
  ).forEach(function(p) {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // Try multiple ways to find the target page
  const target =
    document.getElementById(pageId) ||
    document.getElementById('page-' + pageId) ||
    document.getElementById('section-' + pageId) ||
    document.querySelector('[data-page="' + pageId + '"]') ||
    document.querySelector('[data-page-id="' + pageId + '"]') ||
    document.querySelector('.' + pageId) ||
    document.querySelector('#' + pageId);

  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update nav active states
  document.querySelectorAll('[data-nav],[onclick]').forEach(function(link) {
    const nav = link.getAttribute('data-nav') ||
      (link.getAttribute('onclick') || '').match(/navigateTo\(['"](.*?)['"]\)/)?.[1];
    if (nav) {
      if (nav === pageId) {
        link.classList.add('wg-active-nav');
      } else {
        link.classList.remove('wg-active-nav');
      }
    }
  });

  // Close mobile menu if open
  const mobileMenu = document.getElementById('mobile-menu') ||
    document.getElementById('mobile-nav') ||
    document.querySelector('[class*="mobile-menu"],[class*="mobile-nav"]');
  if (mobileMenu) {
    mobileMenu.classList.add('hidden');
    mobileMenu.style.display = 'none';
  }
};

// ── BIND ALL NAV LINKS ───────────────────────────────────
document.querySelectorAll('a, button').forEach(function(el) {
  const onclick = el.getAttribute('onclick') || '';
  const href = el.getAttribute('href') || '';
  const datanav = el.getAttribute('data-nav') || '';
  const datapage = el.getAttribute('data-page') || '';

  // Already has navigateTo onclick — skip, it works
  if (onclick.includes('navigateTo')) return;

  // Has data-nav or data-page attribute
  if (datanav) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      window.navigateTo(datanav);
    });
    return;
  }
  if (datapage) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      window.navigateTo(datapage);
    });
    return;
  }

  // Anchor links — smooth scroll
  if (href.startsWith('#') && href.length > 1) {
    el.addEventListener('click', function(e) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
});

// ── MOBILE HAMBURGER ─────────────────────────────────────
const hamburgers = document.querySelectorAll(
  '#hamburger, #hamburger-btn, #menu-btn, #nav-toggle, ' +
  '[class*="hamburger"], [class*="menu-toggle"], [class*="nav-toggle"], ' +
  '[aria-label="Open menu"], [aria-label="Menu"], [aria-label="Toggle menu"]'
);
const mobileMenus = document.querySelectorAll(
  '#mobile-menu, #mobile-nav, #nav-menu, ' +
  '[class*="mobile-menu"], [class*="mobile-nav"]'
);

hamburgers.forEach(function(btn) {
  // Skip if already has onclick
  if (btn.getAttribute('onclick')) return;
  btn.addEventListener('click', function() {
    mobileMenus.forEach(function(menu) {
      const isHidden =
        menu.classList.contains('hidden') ||
        menu.style.display === 'none' ||
        getComputedStyle(menu).display === 'none';
      if (isHidden) {
        menu.classList.remove('hidden');
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
      } else {
        menu.classList.add('hidden');
        menu.style.display = 'none';
      }
    });
  });
});

// ── ADD TO CART ──────────────────────────────────────────
let cart = [];
function showToast(msg) {
  let toast = document.getElementById('wg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wg-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%',
      'transform:translateX(-50%)', 'background:#22c55e',
      'color:white', 'padding:12px 24px', 'border-radius:8px',
      'font-weight:bold', 'z-index:99999', 'transition:opacity 0.3s',
      'pointer-events:none', 'font-family:sans-serif'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function() { toast.style.opacity = '0'; }, 2500);
}

document.querySelectorAll('button, a').forEach(function(btn) {
  const txt = (btn.textContent || '').toLowerCase().trim();
  if (
    txt.includes('add to cart') ||
    txt.includes('buy now') ||
    txt.includes('add to bag') ||
    txt.includes('purchase')
  ) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const card =
        this.closest('article') ||
        this.closest('[class*="product"]') ||
        this.closest('[class*="card"]') ||
        this.closest('li') ||
        this.parentElement;
      const nameEl = card && card.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"]');
      const name = nameEl ? nameEl.textContent.trim() : 'Item';
      const priceEl = card && card.querySelector('[class*="price"],[class*="cost"],[class*="amount"]');
      const price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')) : 0;
      const existing = cart.find(function(i) { return i.name === name; });
      if (existing) existing.qty++;
      else cart.push({ name: name, price: price, qty: 1 });
      showToast(name + ' added to cart ✓');
      const total = cart.reduce(function(a,b) { return a + b.qty; }, 0);
      document.querySelectorAll(
        '#cart-count, #cart-badge, [class*="cart-count"], [class*="cart-badge"]'
      ).forEach(function(badge) { badge.textContent = total; });
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
    success.style.cssText = [
      'background:#22c55e', 'color:white', 'padding:20px',
      'border-radius:8px', 'margin-top:16px', 'font-weight:bold',
      'text-align:center', 'font-size:16px', 'font-family:sans-serif'
    ].join(';');
    success.textContent = '✓ Thank you! We will be in touch within 24 hours.';
    form.appendChild(success);
    form.querySelectorAll('input,textarea,select,button[type="submit"],button:not([type])').forEach(function(el) {
      el.setAttribute('disabled', 'true');
    });
  });
});

// ── INIT MULTI-PAGE ──────────────────────────────────────
const allPages = document.querySelectorAll('.page, .page-section');
if (allPages.length > 1) {
  let hasActive = false;
  allPages.forEach(function(p) {
    if (p.classList.contains('active')) hasActive = true;
  });
  if (!hasActive) {
    allPages.forEach(function(p, i) {
      if (i === 0) {
        p.style.display = 'block';
        p.classList.add('active');
      } else {
        p.style.display = 'none';
      }
    });
  }
}

})();
</script>`;

  if (html.includes('</body>')) return html.replace('</body>', script + '</body>');
  return html + script;
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";
    const isMultiPage = userInput.siteType === "multi";
    const fileName = safeFileName(userInput.businessName || "website");

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

${isMultiPage ? `
MULTI-PAGE SITE REQUIRED. Pages: ${pageList}
The exported HTML MUST include:
- A div for each page with class "page-section" and a unique id matching page name in lowercase
- Only the first page visible by default, all others hidden with style="display:none"
- Nav links using onclick="navigateTo('pageid')" to switch pages
- Mobile hamburger button with id="hamburger" toggling id="mobile-menu"
` : `
SINGLE PAGE SITE REQUIRED. Sections: ${pageList}
The exported HTML MUST include:
- Each section with a unique id in lowercase
- Nav links using href="#sectionid" for smooth scroll
- Mobile hamburger button with id="hamburger" toggling id="mobile-menu"
`}

Make it premium, conversion-focused and visually stunning for: ${userInput.businessName} — ${userInput.industry}`
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

    const finalHtml = injectEssentials(stitchHtml);
    console.log("STEP 5: JS injected");

    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, {
      html: finalHtml,
      title: spec.projectTitle,
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
        <p><strong>Email:</strong> ${userInput.email}</p>
        <p><strong>Phone:</strong> ${userInput.phone}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Site Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "-"}</p>
        <p><strong>Style:</strong> ${userInput.style}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <br/>
        <p>Site attached. Click below for a deeper Claude fix pass if needed:</p>
        <br/>
        <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          ✅ Fix This Site
        </a>
        <br/><br/>
        <p style="color:#94a3b8;font-size:12px;">Link expires in 24 hours.</p>
      `,
      attachments: [{
        filename: `${fileName}.html`,
        content: Buffer.from(finalHtml).toString("base64"),
      }],
    });
    console.log("STEP 6 DONE");

    if (userInput.email) {
      console.log("STEP 7: Emailing client...");
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: userInput.email,
        subject: `We've received your website request!`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
            <h1 style="font-size:28px;margin-bottom:8px;">Thank you, ${userInput.name}!</h1>
            <p style="color:#666;margin-bottom:32px;">We have received your website request and our team is reviewing it now.</p>
            <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin-bottom:32px;">
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
            <p style="color:#666;">Our team will be in touch within <strong>24 hours</strong> with your website preview.</p>
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