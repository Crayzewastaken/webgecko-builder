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

function injectEssentials(html: string): string {
  const script = `
<script>
// ── CART ─────────────────────────────────────────────────
let cart = [];
function addToCart(name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) existing.qty++;
  else cart.push({ name, price, qty: 1 });
  updateCartUI();
  showToast(name + ' added to cart');
}
function updateCartUI() {
  const badge = document.getElementById('cart-count');
  if (badge) badge.textContent = cart.reduce((a,b) => a + b.qty, 0);
  const cartList = document.getElementById('cart-items');
  if (cartList) {
    cartList.innerHTML = cart.map(i =>
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333">' +
      '<span>' + i.name + ' x' + i.qty + '</span>' +
      '<span>$' + (i.price * i.qty) + '</span></div>'
    ).join('') || '<p style="color:#888">Your cart is empty</p>';
  }
}
function showToast(msg) {
  let toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:9999;transition:opacity 0.3s';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ── ADD TO CART BUTTONS ──────────────────────────────────
document.querySelectorAll('button').forEach(btn => {
  if (btn.textContent.toLowerCase().includes('add to cart')) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const card = this.closest('[data-name]') || this.closest('article') || this.closest('.product-card') || this.parentElement;
      const name = card?.querySelector('h3,h2,h4')?.textContent?.trim() || 'Item';
      const priceEl = card?.querySelector('[class*="price"]');
      const price = parseFloat(priceEl?.textContent?.replace(/[^0-9.]/g,'') || '0');
      addToCart(name, price);
    });
  }
});

// ── CONTACT FORMS ────────────────────────────────────────
document.querySelectorAll('form').forEach(form => {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const success = document.createElement('div');
    success.style.cssText = 'background:#22c55e;color:white;padding:20px;border-radius:8px;margin-top:16px;font-weight:bold;text-align:center;';
    success.textContent = 'Thank you! We will be in touch within 24 hours.';
    form.appendChild(success);
    form.querySelectorAll('input,textarea,select,button').forEach(el => el.setAttribute('disabled','true'));
  });
});

// ── MOBILE HAMBURGER ─────────────────────────────────────
const hamburger = document.getElementById('hamburger') ||
  document.querySelector('[class*="hamburger"],[aria-label*="menu"],[id*="hamburger"]');
const mobileNav = document.getElementById('mobile-nav') ||
  document.getElementById('mobile-menu') ||
  document.querySelector('[class*="mobile-nav"],[class*="mobile-menu"]');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', function() {
    const isHidden = mobileNav.classList.contains('hidden') || mobileNav.style.display === 'none';
    if (isHidden) {
      mobileNav.classList.remove('hidden');
      mobileNav.style.display = 'block';
    } else {
      mobileNav.classList.add('hidden');
      mobileNav.style.display = 'none';
    }
  });
}
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

    // STEP 1: Claude spec
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
MULTI-PAGE SITE REQUIRED.
Pages: ${pageList}
Build a multi-page website where each page (${pageList}) is a separate full section.
Navigation uses data-page attributes and JavaScript navigateTo() to switch between pages.
Each page hidden by default except Home which is active.
Every nav link must correspond to a real page.
` : `
SINGLE PAGE SITE REQUIRED.
Sections: ${pageList}
Build a single scrollable page with each section having its own id.
Navigation smooth scrolls to each section.
Hamburger menu on mobile.
`}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    // STEP 2: Create project
    console.log("STEP 2: Creating project...");
    const project: any = await stitchClient.callTool("create_project", { title: spec.projectTitle });
    const projectId = project?.name?.split("/")[1];
    console.log("STEP 2 DONE:", projectId);

    // STEP 3: Generate screen
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

    // STEP 4: Fetch HTML
    console.log("STEP 4: Fetching HTML...");
    const stitchHtml = await fetch(downloadUrl).then((r) => r.text());
    console.log("STEP 4 DONE. Length:", stitchHtml.length);

    // STEP 5: Inject cart + form essentials
    const finalHtml = injectEssentials(stitchHtml);
    console.log("STEP 5 DONE");

    // STEP 6: Save to Redis for fix button
    const jobId = `job_${Date.now()}`;
    await redis.set(jobId, {
      html: finalHtml,
      title: spec.projectTitle,
      userInput,
    }, { ex: 86400 });

    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/process?id=${jobId}&secret=${process.env.PROCESS_SECRET}`;

    // STEP 7: Email YOU with full details + fix button
    console.log("STEP 7: Emailing owner...");
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
        <p>Raw site with cart + form interactions is attached. Click below to run the full Claude fix pass:</p>
        <br/>
        <a href="${processUrl}" style="background:#22c55e;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          ✅ Fix This Site
        </a>
        <br/><br/>
        <p style="color:#94a3b8;font-size:12px;">Link expires in 24 hours.</p>
      `,
      attachments: [{
        filename: "site.html",
        content: Buffer.from(finalHtml).toString("base64"),
      }],
    });
    console.log("STEP 7 DONE");

    // STEP 8: Send receipt to CLIENT
    if (userInput.email) {
      console.log("STEP 8: Emailing client receipt...");
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: userInput.email,
        subject: `We've received your website request!`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
            <h1 style="font-size:28px;margin-bottom:8px;">Thank you, ${userInput.name}!</h1>
            <p style="color:#666;margin-bottom:32px;">We have received your website request and our team is reviewing it now. Here is a summary of what you submitted:</p>
            
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
            <p style="color:#666;">If you have any questions reply to this email.</p>
            <br/>
            <div style="border-top:1px solid #eee;padding-top:20px;margin-top:20px;">
              <p style="color:#999;font-size:12px;">WebGecko — Professional Web Design</p>
              <p style="color:#999;font-size:12px;">webgecko.au</p>
            </div>
          </div>
        `,
      });
      console.log("STEP 8 DONE");
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