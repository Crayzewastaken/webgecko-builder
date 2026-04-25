
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";
import { Resend } from "resend";

const redis = Redis.fromEnv();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationResult {
  service: string;
  status: "ok" | "skipped" | "error";
  embedCode?: string;
  details?: string;
  error?: string;
}

interface ProvisionedIntegrations {
  formspree?: IntegrationResult;
  googleMaps?: IntegrationResult;
  elfsightReviews?: IntegrationResult;
  elfsightGallery?: IntegrationResult;
  crisp?: IntegrationResult;
  mailerlite?: IntegrationResult;
  calendly?: IntegrationResult;
  stripe?: IntegrationResult;
}

// ─── Turnstile ───────────────────────────────────────────────────────────────

async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
  });
  const data = await res.json();
  return data.success === true;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => { if (err || !result) reject(err); else resolve(result.secure_url); }
    );
    stream.end(buffer);
  });
}

// ─── Integrations ─────────────────────────────────────────────────────────────
// Each returns IntegrationResult. Missing API keys = "skipped" not "error".
// Always returns embed code — either live or placeholder.

async function provisionFormspree(businessName: string, email: string): Promise<IntegrationResult> {
  const key = process.env.FORMSPREE_API_KEY;
  if (!key) {
    return {
      service: "Formspree", status: "skipped",
      embedCode: `<form action="https://formspree.io/f/PLACEHOLDER" method="POST" class="contact-form">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="_replyto" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message" required></textarea>
  <button type="submit">Send Message</button>
</form>`,
      details: "Add FORMSPREE_API_KEY to Vercel env to auto-provision"
    };
  }
  try {
    const res = await fetch("https://api.formspree.io/api/0/forms", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${businessName} Contact Form`, email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Formspree API error");
    const formId = data.hashid;
    return {
      service: "Formspree", status: "ok",
      embedCode: `<form action="https://formspree.io/f/${formId}" method="POST" class="contact-form">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="_replyto" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message" required></textarea>
  <button type="submit">Send Message</button>
</form>`,
      details: `Form ID: ${formId}`
    };
  } catch (e: any) {
    return { service: "Formspree", status: "error", error: e.message };
  }
}

async function provisionGoogleMaps(businessAddress: string, businessName: string): Promise<IntegrationResult> {
  if (!businessAddress) return { service: "Google Maps", status: "skipped", details: "No address provided" };
  const key = process.env.GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_KEY";
  const q = encodeURIComponent(`${businessName} ${businessAddress}`);
  return {
    service: "Google Maps",
    status: process.env.GOOGLE_MAPS_API_KEY ? "ok" : "skipped",
    embedCode: `<div class="maps-section" style="margin:40px 0;">
  <iframe src="https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}"
    width="100%" height="400" style="border:0;border-radius:12px;" allowfullscreen loading="lazy">
  </iframe>
</div>`,
    details: process.env.GOOGLE_MAPS_API_KEY ? "Live embed" : "Add GOOGLE_MAPS_API_KEY to Vercel env"
  };
}

async function provisionElfsightReviews(businessName: string): Promise<IntegrationResult> {
  const key = process.env.ELFSIGHT_API_KEY;
  if (!key) {
    return {
      service: "Elfsight Reviews", status: "skipped",
      embedCode: `<div class="reviews-widget">
  <script src="https://static.elfsight.com/platform/platform.js" defer></script>
  <div class="elfsight-app-REVIEWS-PLACEHOLDER" data-elfsight-app-lazy></div>
</div>`,
      details: "Add ELFSIGHT_API_KEY to Vercel env to auto-provision"
    };
  }
  try {
    const res = await fetch("https://api.elfsight.com/service/widgets", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "google-reviews", name: `${businessName} Reviews` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    const widgetId = data.data?.id;
    return {
      service: "Elfsight Reviews", status: "ok",
      embedCode: `<div class="reviews-widget">
  <script src="https://static.elfsight.com/platform/platform.js" defer></script>
  <div class="elfsight-app-${widgetId}" data-elfsight-app-lazy></div>
</div>`,
      details: `Widget ID: ${widgetId}`
    };
  } catch (e: any) {
    return { service: "Elfsight Reviews", status: "error", error: e.message };
  }
}

async function provisionElfsightGallery(businessName: string): Promise<IntegrationResult> {
  const key = process.env.ELFSIGHT_API_KEY;
  if (!key) {
    return {
      service: "Elfsight Gallery", status: "skipped",
      embedCode: `<div class="gallery-widget">
  <script src="https://static.elfsight.com/platform/platform.js" defer></script>
  <div class="elfsight-app-GALLERY-PLACEHOLDER" data-elfsight-app-lazy></div>
</div>`,
      details: "Add ELFSIGHT_API_KEY to Vercel env"
    };
  }
  try {
    const res = await fetch("https://api.elfsight.com/service/widgets", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "instagram-feed", name: `${businessName} Gallery` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    const widgetId = data.data?.id;
    return {
      service: "Elfsight Gallery", status: "ok",
      embedCode: `<div class="gallery-widget">
  <script src="https://static.elfsight.com/platform/platform.js" defer></script>
  <div class="elfsight-app-${widgetId}" data-elfsight-app-lazy></div>
</div>`,
      details: `Widget ID: ${widgetId}`
    };
  } catch (e: any) {
    return { service: "Elfsight Gallery", status: "error", error: e.message };
  }
}

async function provisionCrisp(businessName: string, email: string): Promise<IntegrationResult> {
  const key = process.env.CRISP_API_KEY;
  const identifier = process.env.CRISP_API_IDENTIFIER;
  if (!key || !identifier) {
    return {
      service: "Crisp Chat", status: "skipped",
      embedCode: `<script type="text/javascript">
  window.$crisp=[];
  window.CRISP_WEBSITE_ID="PLACEHOLDER-ADD-CRISP-ID";
  (function(){var d=document;var s=d.createElement("script");
  s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
</script>`,
      details: "Add CRISP_API_KEY and CRISP_API_IDENTIFIER to Vercel env"
    };
  }
  try {
    const res = await fetch("https://api.crisp.chat/v1/website", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${identifier}:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
        "X-Crisp-Tier": "plugin",
      },
      body: JSON.stringify({ name: businessName, domain: email.split("@")[1] || "webgecko.au" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    const websiteId = data.data?.website_id;
    return {
      service: "Crisp Chat", status: "ok",
      embedCode: `<script type="text/javascript">
  window.$crisp=[];
  window.CRISP_WEBSITE_ID="${websiteId}";
  (function(){var d=document;var s=d.createElement("script");
  s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
</script>`,
      details: `Website ID: ${websiteId}`
    };
  } catch (e: any) {
    return { service: "Crisp Chat", status: "error", error: e.message };
  }
}

async function provisionMailerLite(businessName: string): Promise<IntegrationResult> {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) {
    return {
      service: "MailerLite", status: "skipped",
      embedCode: `<div class="newsletter-section">
  <form class="newsletter-form">
    <input type="email" placeholder="Enter your email" required />
    <button type="submit">Subscribe</button>
  </form>
</div>`,
      details: "Add MAILERLITE_API_KEY to Vercel env"
    };
  }
  try {
    const groupRes = await fetch("https://connect.mailerlite.com/api/groups", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${businessName} Subscribers` }),
    });
    const groupData = await groupRes.json();
    if (!groupRes.ok) throw new Error(JSON.stringify(groupData));
    const groupId = groupData.data?.id;
    return {
      service: "MailerLite", status: "ok",
      embedCode: `<div class="newsletter-section" data-mailerlite-group="${groupId}">
  <form class="newsletter-form" onsubmit="handleNewsletterSubmit(event, '${groupId}')">
    <input type="email" name="email" placeholder="Enter your email" required />
    <button type="submit">Subscribe</button>
  </form>
</div>
<script>
async function handleNewsletterSubmit(e, groupId) {
  e.preventDefault();
  const email = e.target.querySelector('input[name=email]').value;
  try {
    await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer ${key}'},
      body: JSON.stringify({email, groups:[groupId]})
    });
    e.target.innerHTML = '<p style="color:#10b981;font-weight:600;">Thanks for subscribing!</p>';
  } catch(err) { console.error(err); }
}
</script>`,
      details: `Group ID: ${groupId}`
    };
  } catch (e: any) {
    return { service: "MailerLite", status: "error", error: e.message };
  }
}

async function provisionCalendly(businessName: string, email: string): Promise<IntegrationResult> {
  const key = process.env.CALENDLY_API_KEY;
  const orgUri = process.env.CALENDLY_ORG_URI;
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (!key || !orgUri) {
    return {
      service: "Calendly", status: "skipped",
      embedCode: `<div class="booking-section">
  <div class="calendly-inline-widget"
    data-url="https://calendly.com/${slug}"
    style="min-width:320px;height:630px;">
  </div>
  <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
</div>`,
      details: "Add CALENDLY_API_KEY and CALENDLY_ORG_URI to Vercel env. Update the Calendly URL with the client's link."
    };
  }
  try {
    await fetch(`${orgUri}/invitations`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return {
      service: "Calendly", status: "ok",
      embedCode: `<div class="booking-section">
  <div class="calendly-inline-widget"
    data-url="https://calendly.com/${slug}"
    style="min-width:320px;height:630px;">
  </div>
  <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
</div>`,
      details: `Invitation sent to ${email}`
    };
  } catch (e: any) {
    return { service: "Calendly", status: "error", error: e.message };
  }
}

async function provisionStripe(businessName: string): Promise<IntegrationResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return {
      service: "Stripe Shop", status: "skipped",
      embedCode: `<div class="shop-section">
  <a href="#" class="buy-button" style="display:inline-block;background:#10b981;color:#fff;padding:14px 28px;border-radius:8px;font-weight:700;text-decoration:none;">Buy Now</a>
  <!-- Add STRIPE_SECRET_KEY to Vercel env to auto-provision payment links -->
</div>`,
      details: "Add STRIPE_SECRET_KEY to Vercel env"
    };
  }
  try {
    const productRes = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: `${businessName} - Product`, description: "Update in Stripe dashboard" }),
    });
    const product = await productRes.json();
    if (!productRes.ok) throw new Error(product.error?.message);
    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ product: product.id, unit_amount: "5000", currency: "aud" }),
    });
    const price = await priceRes.json();
    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "line_items[0][price]": price.id, "line_items[0][quantity]": "1" }),
    });
    const link = await linkRes.json();
    if (!linkRes.ok) throw new Error(link.error?.message);
    return {
      service: "Stripe Shop", status: "ok",
      embedCode: `<div class="shop-section">
  <a href="${link.url}" class="buy-button stripe-button" target="_blank"
    style="display:inline-block;background:#10b981;color:#fff;padding:14px 28px;border-radius:8px;font-weight:700;text-decoration:none;">
    Buy Now
  </a>
</div>`,
      details: `Payment link: ${link.url}`
    };
  } catch (e: any) {
    return { service: "Stripe Shop", status: "error", error: e.message };
  }
}

// ─── Run all provisioning in parallel ─────────────────────────────────────────

async function provisionIntegrations(
  features: string[],
  businessName: string,
  businessAddress: string,
  email: string
): Promise<ProvisionedIntegrations> {
  const results: ProvisionedIntegrations = {};
  const tasks: Promise<void>[] = [];

  tasks.push(provisionFormspree(businessName, email).then(r => { results.formspree = r; }));

  if (features.includes('Google Maps'))
    tasks.push(provisionGoogleMaps(businessAddress, businessName).then(r => { results.googleMaps = r; }));
  if (features.includes('Reviews & Testimonials'))
    tasks.push(provisionElfsightReviews(businessName).then(r => { results.elfsightReviews = r; }));
  if (features.includes('Photo Gallery'))
    tasks.push(provisionElfsightGallery(businessName).then(r => { results.elfsightGallery = r; }));
  if (features.includes('Live Chat'))
    tasks.push(provisionCrisp(businessName, email).then(r => { results.crisp = r; }));
  if (features.includes('Newsletter Signup'))
    tasks.push(provisionMailerLite(businessName).then(r => { results.mailerlite = r; }));
  if (features.includes('Booking System'))
    tasks.push(provisionCalendly(businessName, email).then(r => { results.calendly = r; }));
  if (features.includes('Payments / Shop'))
    tasks.push(provisionStripe(businessName).then(r => { results.stripe = r; }));

  await Promise.allSettled(tasks);
  return results;
}

function buildEmbedSummary(integrations: ProvisionedIntegrations): string {
  const lines: string[] = [];
  for (const result of Object.values(integrations)) {
    if (result?.embedCode) {
      lines.push(`### ${result.service} (${result.status})\n\`\`\`html\n${result.embedCode}\n\`\`\``);
    }
  }
  return lines.length > 0
    ? `EMBED CODES — place each in the correct section of the site:\n\n${lines.join('\n\n')}`
    : "No integrations provisioned.";
}

// ─── Watermark ────────────────────────────────────────────────────────────────

function injectWatermark(html: string): string {
  const watermark = `
<style>
#wg-watermark{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;
background:repeating-linear-gradient(-45deg,transparent,transparent 120px,rgba(16,185,129,0.05) 120px,rgba(16,185,129,0.05) 122px);}
#wg-watermark::after{content:'WEBGECKO PREVIEW';position:fixed;top:50%;left:50%;
transform:translate(-50%,-50%) rotate(-30deg);font-family:sans-serif;font-size:32px;font-weight:700;
letter-spacing:6px;color:rgba(16,185,129,0.10);white-space:nowrap;pointer-events:none;}
#wg-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(10,15,26,0.96);
border-top:1px solid rgba(16,185,129,0.3);color:#10b981;font-family:sans-serif;font-size:12px;
padding:8px 16px;text-align:center;z-index:99999;pointer-events:none;}
</style>
<div id="wg-watermark"></div>
<div id="wg-bar">WebGecko Development Preview - Not yet live - webgecko.au</div>
<script>
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&'IJC'.includes(e.key))||(e.ctrlKey&&e.key==='U'))e.preventDefault();
});
</script>`;
  return html.includes('</body>') ? html.replace('</body>', watermark + '</body>') : html + watermark;
}

// ─── Vercel deploy ─────────────────────────────────────────────────────────────

async function deployToVercel(jobId: string, html: string): Promise<string | null> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  try {
    const projectName = `wg-${jobId.slice(0, 8)}`;
    const body: any = {
      name: projectName,
      files: [{ file: "index.html", data: Buffer.from(html).toString("base64"), encoding: "base64" }],
      projectSettings: { framework: null },
      target: "preview",
    };
    if (process.env.VERCEL_TEAM_ID) body.teamId = process.env.VERCEL_TEAM_ID;
    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.url ? `https://${data.url}` : null;
  } catch (e) {
    console.error("Vercel deploy failed:", e);
    return null;
  }
}

// ─── CSS extract ──────────────────────────────────────────────────────────────

function extractCSS(html: string): string {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n\n');
  return `/* WebGecko Generated Styles - Paste into WordPress Additional CSS */\n\n${styles}`;
}

// ─── Link checker ─────────────────────────────────────────────────────────────

function checkLinks(html: string): string {
  const issues: string[] = [];
  const dead = [...html.matchAll(/href="(#|javascript:void\(0\))"/g)];
  if (dead.length) issues.push(`${dead.length} dead href="#" links found`);
  const noAlt = [...html.matchAll(/<img(?![^>]*alt=)[^>]*>/g)];
  if (noAlt.length) issues.push(`${noAlt.length} images missing alt text`);
  return issues.length ? `Issues:\n- ${issues.join('\n- ')}` : 'No issues found';
}

// ─── Inject essentials ────────────────────────────────────────────────────────

function injectEssentials(html: string): string {
  const script = `<script>
(function(){
  window.navigateTo=function(p){
    document.querySelectorAll('[data-page]').forEach(x=>x.style.display='none');
    var t=document.querySelector('[data-page="'+p+'"]');
    if(t){t.style.display='block';window.scrollTo(0,0);}
  };
  document.querySelectorAll('[data-nav]').forEach(function(el){
    el.addEventListener('click',function(e){e.preventDefault();window.navigateTo(this.getAttribute('data-nav'));});
  });
  var hb=document.getElementById('hamburger'),mm=document.getElementById('mobile-menu');
  if(hb&&mm){hb.addEventListener('click',function(){var o=mm.style.display==='block';mm.style.display=o?'none':'block';});}
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q=item.querySelector('.faq-question,h3,h4'),a=item.querySelector('.faq-answer,p');
    if(q&&a){a.style.display='none';q.style.cursor='pointer';q.addEventListener('click',function(){a.style.display=a.style.display==='block'?'none':'block';});}
  });
  window.addToCart=function(n,p){
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:24px;right:24px;background:#10b981;color:white;padding:12px 20px;border-radius:12px;font-weight:600;z-index:9999;font-family:sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    t.textContent=(n||'Item')+' added to cart';
    document.body.appendChild(t);
    setTimeout(function(){t.remove();},3000);
  };
  document.querySelectorAll('form').forEach(function(form){
    var action=form.getAttribute('action')||'';
    if(!action.includes('formspree.io')&&!action.includes('http')){
      form.addEventListener('submit',function(e){
        e.preventDefault();
        form.innerHTML='<div style="text-align:center;padding:32px;"><p style="color:#10b981;font-size:18px;font-weight:600;">Message sent! We\'ll be in touch shortly.</p></div>';
      });
    }
  });
  var pages=document.querySelectorAll('[data-page]');
  if(pages.length>1){pages.forEach(function(p,i){p.style.display=i===0?'block':'none';});}
})();
</script>`;
  return html.includes('</body>') ? html.replace('</body>', script + '</body>') : html + script;
}

// ─── Inject images ─────────────────────────────────────────────────────────────

function injectImages(
  html: string,
  logoUrl: string | null,
  heroUrl: string | null,
  photoUrls: string[],
  productPhotoMap: { name: string; url: string }[]
): string {
  let script = '<script>\n(function(){\n';
  if (logoUrl) {
    script += `var li=document.querySelector('header img,nav img,.logo img,#logo img');
if(li){li.src='${logoUrl}';li.style.maxHeight='60px';}
else{var lt=document.querySelector('.logo,#logo,header .brand');
if(lt){var li2=document.createElement('img');li2.src='${logoUrl}';li2.style.maxHeight='60px';lt.insertBefore(li2,lt.firstChild);}}\n`;
  }
  if (heroUrl) {
    script += `var hr=document.querySelector('.hero,#hero,[class*="hero"],section:first-of-type');
if(hr){var cs=window.getComputedStyle(hr);
if(cs.backgroundImage==='none'){hr.style.backgroundImage='url(${heroUrl})';hr.style.backgroundSize='cover';hr.style.backgroundPosition='center';}
else{var hi=hr.querySelector('img');if(hi)hi.src='${heroUrl}';}}\n`;
  }
  productPhotoMap.forEach(({ name, url }) => {
    const safe = name.replace(/'/g, "\\'").toLowerCase();
    script += `(function(){var els=Array.from(document.querySelectorAll('.product,.item,.menu-item,.service-item'));
var m=els.find(function(el){return el.textContent.toLowerCase().includes('${safe}');});
if(m){var img=m.querySelector('img');if(img)img.src='${url}';}})();\n`;
  });
  photoUrls.forEach((url, i) => {
    script += `(function(){var gi=document.querySelectorAll('.gallery img,.photos img,[class*="gallery"] img');
if(gi[${i}])gi[${i}].src='${url}';})();\n`;
  });
  script += '})();\n</script>';
  return html.includes('</body>') ? html.replace('</body>', script + '</body>') : html + script;
}

// ─── Quote calculator (server mirror) ─────────────────────────────────────────

function calculateQuote(pages: string[], features: string[], siteType: string) {
  const pageCount = pages.length || 1;
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const hasBlog = features.includes('Blog');
  const isMultiPage = siteType === 'multi';
  let packageName = 'Starter', basePrice = 1800, competitorPrice = 3500;
  if (pageCount >= 8 || hasEcommerce || hasBooking) { packageName = 'Premium'; basePrice = 5500; competitorPrice = 15000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = 'Business'; basePrice = 3200; competitorPrice = 7500; }
  let addons = 0;
  if (hasEcommerce && packageName !== 'Premium') addons += 300;
  if (hasBooking && packageName !== 'Premium') addons += 200;
  if (hasBlog) addons += 150;
  if (features.includes('Photo Gallery')) addons += 100;
  if (features.includes('Reviews & Testimonials')) addons += 100;
  if (features.includes('Live Chat')) addons += 150;
  if (features.includes('Newsletter Signup')) addons += 100;
  const totalPrice = basePrice + addons;
  const monthlyPrice = packageName === 'Premium' ? 149 : packageName === 'Business' ? 99 : 79;
  const savings = competitorPrice - totalPrice;
  const deposit = Math.round(totalPrice / 2);
  return { packageName, totalPrice, monthlyPrice, savings, competitorPrice, deposit };
}

// ─── Email builders ───────────────────────────────────────────────────────────

function buildOwnerEmail(p: any): string {
  const integrationRows = Object.values(p.integrations as ProvisionedIntegrations)
    .filter(Boolean)
    .map((r: any) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;">${r.service}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;">${r.status === 'ok' ? '✅ Live' : r.status === 'skipped' ? '⚠️ Skipped' : '❌ Error'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8;">${r.details || r.error || ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:-apple-system,sans-serif;background:#0a0f1a;color:#e2e8f0;margin:0;padding:24px;}
.card{background:#0f1623;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:16px;}
h2{color:#10b981;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;}
td{vertical-align:top;} table{width:100%;border-collapse:collapse;font-size:13px;}
a.btn{display:inline-block;background:#10b981;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-right:8px;}
</style></head><body><div style="max-width:640px;margin:0 auto;">
<div style="text-align:center;margin-bottom:24px;">
  <h1 style="color:#10b981;font-size:22px;margin:0;">New WebGecko Job</h1>
  <p style="color:#64748b;font-size:12px;">ID: ${p.jobId}</p>
</div>
<div class="card"><h2>Client</h2><table>
  <tr><td style="color:#64748b;width:130px;padding:5px 0;">Business</td><td style="padding:5px 0;font-weight:600;">${p.businessName}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Contact</td><td style="padding:5px 0;">${p.name}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Email</td><td style="padding:5px 0;"><a href="mailto:${p.email}" style="color:#10b981;">${p.email}</a></td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Phone</td><td style="padding:5px 0;">${p.phone}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">ABN</td><td style="padding:5px 0;">${p.abn || 'Not provided'}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Address</td><td style="padding:5px 0;">${p.businessAddress || 'Not provided'}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Industry</td><td style="padding:5px 0;">${p.industry}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Goal</td><td style="padding:5px 0;">${p.goal}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Type</td><td style="padding:5px 0;">${p.siteType}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Pages</td><td style="padding:5px 0;">${p.pages.join(', ')}</td></tr>
  <tr><td style="color:#64748b;padding:5px 0;">Features</td><td style="padding:5px 0;">${p.features.join(', ')}</td></tr>
</table></div>
<div class="card"><h2>Quote</h2>
  <p style="font-size:28px;font-weight:700;color:#fff;margin:0 0 4px;">$${p.quote.totalPrice.toLocaleString()} <span style="font-size:14px;color:#64748b;font-weight:400;">${p.quote.packageName}</span></p>
  <p style="color:#10b981;margin:0 0 4px;">Deposit: $${p.quote.deposit.toLocaleString()}</p>
  <p style="color:#64748b;font-size:13px;margin:0;">+ $${p.quote.monthlyPrice}/month hosting</p>
</div>
<div class="card"><h2>Integrations</h2>
  <table><tr style="background:#1e293b;">
    <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:12px;">Service</th>
    <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:12px;">Status</th>
    <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:12px;">Details</th>
  </tr>${integrationRows}</table>
</div>
${p.previewUrl ? `<div class="card"><h2>Preview</h2>
  <a href="${p.previewUrl}" class="btn">View Preview</a>
  <a href="${p.processUrl}" class="btn" style="background:#1e293b;color:#10b981;border:1px solid rgba(16,185,129,0.3);">Fix This Site</a>
</div>` : `<div class="card"><h2>Actions</h2><a href="${p.processUrl}" class="btn">Fix This Site</a></div>`}
<div class="card"><h2>Link Report</h2>
  <pre style="font-size:12px;color:#94a3b8;margin:0;white-space:pre-wrap;">${p.linkReport}</pre>
</div>
</div></body></html>`;
}

function buildClientEmail(p: any): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:-apple-system,sans-serif;background:#0a0f1a;color:#e2e8f0;margin:0;padding:24px;}
.card{background:#0f1623;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:16px;}
</style></head><body><div style="max-width:560px;margin:0 auto;">
<div style="text-align:center;margin-bottom:32px;">
  <div style="font-size:40px;margin-bottom:12px;">🦎</div>
  <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">You're all set, ${p.name.split(' ')[0]}!</h1>
  <p style="color:#64748b;margin:0;">Your ${p.businessName} website is being built right now.</p>
</div>
<div class="card">
  <h2 style="color:#10b981;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Your order</h2>
  <p style="margin:0 0 6px;font-weight:600;">${p.businessName} — ${p.quote.packageName} Package</p>
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Pages: ${p.pages.join(', ')}</p>
  ${p.features.length > 0 ? `<p style="margin:0;color:#64748b;font-size:13px;">Features: ${p.features.join(', ')}</p>` : ''}
</div>
<div class="card" style="border-color:rgba(16,185,129,0.2);">
  <h2 style="color:#10b981;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Investment</h2>
  <p style="font-size:32px;font-weight:700;color:#fff;margin:0 0 4px;">$${p.quote.totalPrice.toLocaleString()}</p>
  <p style="color:#64748b;margin:0 0 12px;font-size:13px;">+ $${p.quote.monthlyPrice}/month hosting</p>
  <div style="background:rgba(16,185,129,0.1);border-radius:10px;padding:12px;margin-bottom:12px;">
    <p style="color:#10b981;font-weight:600;margin:0;">Saving $${p.quote.savings.toLocaleString()} vs a typical agency</p>
  </div>
  <p style="color:#94a3b8;font-size:13px;margin:0;">50% deposit ($${p.quote.deposit.toLocaleString()}) — secure payment link coming within 24 hours.</p>
</div>
<div class="card">
  <h2 style="color:#10b981;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Your 10-12 day timeline</h2>
  ${[['⚡','Right now','Building has started'],['📧','Day 1','Full confirmation email'],['🎨','Days 3-5','First preview link'],['✏️','Days 6-9','Up to 2 revision rounds'],['🚀','Days 10-12','Goes live on your .com.au']].map(([icon,day,desc])=>`
  <div style="display:flex;gap:12px;margin-bottom:10px;">
    <span style="font-size:16px;width:24px;flex-shrink:0;">${icon}</span>
    <div><p style="margin:0;font-weight:600;font-size:13px;">${day}</p><p style="margin:0;color:#64748b;font-size:12px;">${desc}</p></div>
  </div>`).join('')}
</div>
<p style="text-align:center;color:#475569;font-size:12px;">Questions? <a href="mailto:hello@webgecko.au" style="color:#10b981;">hello@webgecko.au</a></p>
</div></body></html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Verify Turnstile
    const turnstileToken = formData.get("turnstileToken") as string;
    if (!await verifyTurnstile(turnstileToken)) {
      return NextResponse.json({ error: "Security check failed" }, { status: 403 });
    }

    // Parse fields
    const businessName = formData.get("businessName") as string;
    const industry = formData.get("industry") as string;
    const usp = formData.get("usp") as string;
    const existingWebsite = formData.get("existingWebsite") as string;
    const targetAudience = formData.get("targetAudience") as string;
    const businessAddress = formData.get("businessAddress") as string;
    const goal = formData.get("goal") as string;
    const siteType = formData.get("siteType") as string;
    const hasPricing = formData.get("hasPricing") as string;
    const pricingType = formData.get("pricingType") as string;
    const pricingMethod = formData.get("pricingMethod") as string;
    const pricingDetails = formData.get("pricingDetails") as string;
    const pricingUrl = formData.get("pricingUrl") as string;
    const style = formData.get("style") as string;
    const colorPrefs = formData.get("colorPrefs") as string;
    const references = formData.get("references") as string;
    const hasLogo = formData.get("hasLogo") as string;
    const hasContent = formData.get("hasContent") as string;
    const additionalNotes = formData.get("additionalNotes") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const abn = formData.get("abn") as string;
    const pages: string[] = JSON.parse(formData.get("pages") as string || "[]");
    const features: string[] = JSON.parse(formData.get("features") as string || "[]");
    const products: { name: string; price: string }[] = JSON.parse(formData.get("products") as string || "[]");

    const jobId = crypto.randomUUID();
    const quote = calculateQuote(pages, features, siteType);

    // ── Parallel: image uploads + integration provisioning ────────────────────

    let logoUrl: string | null = null;
    let heroUrl: string | null = null;
    const photoUrls: string[] = [];
    const productPhotoMap: { name: string; url: string }[] = [];
    let pricingSheetUrl: string | null = null;

    const imageUploads: Promise<void>[] = [];
    const logoFile = formData.get("logo") as File | null;
    if (logoFile?.size > 0) imageUploads.push(uploadToCloudinary(logoFile, `webgecko/${businessName}/`).then(u => { logoUrl = u; }));
    const heroFile = formData.get("hero") as File | null;
    if (heroFile?.size > 0) imageUploads.push(uploadToCloudinary(heroFile, `webgecko/${businessName}/`).then(u => { heroUrl = u; }));
    for (let i = 0; i < 5; i++) {
      const f = formData.get(`photo_${i}`) as File | null;
      if (f?.size > 0) { const idx = i; imageUploads.push(uploadToCloudinary(f, `webgecko/${businessName}/`).then(u => { photoUrls[idx] = u; })); }
    }
    for (let i = 0; i < 12; i++) {
      const f = formData.get(`product_photo_${i}`) as File | null;
      if (f?.size > 0 && products[i]) { const idx = i; imageUploads.push(uploadToCloudinary(f, `webgecko/${businessName}/products/`).then(u => { productPhotoMap[idx] = { name: products[idx].name, url: u }; })); }
    }
    const psFile = formData.get("pricing_sheet") as File | null;
    if (psFile?.size > 0) imageUploads.push(uploadToCloudinary(psFile, `webgecko/${businessName}/`).then(u => { pricingSheetUrl = u; }));

    const [, integrations] = await Promise.all([
      Promise.allSettled(imageUploads),
      provisionIntegrations(features, businessName, businessAddress, email),
    ]);

    const embedSummary = buildEmbedSummary(integrations);

    // ── Pricing context ──────────────────────────────────────────────────────

    let pricingContext = "";
    if (hasPricing === "Yes") {
      if (pricingMethod === "manual" && products.length > 0) {
        pricingContext = products.map(p => `- ${p.name}: ${p.price}`).join('\n');
      } else if (pricingMethod === "url" && pricingUrl) {
        pricingContext = `Pull pricing from: ${pricingUrl}`;
      } else if (pricingMethod === "upload" && pricingSheetUrl) {
        pricingContext = `Pricing sheet: ${pricingSheetUrl}`;
      } else if (pricingMethod === "weknow") {
        pricingContext = "Create industry-standard pricing for this business type.";
      } else {
        pricingContext = pricingDetails || "Create appropriate pricing.";
      }
    }

    // ── Claude pass 1: Stitch prompt ────────────────────────────────────────

    const pass1 = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a senior UI designer. Generate a JSON object with "projectTitle" and "stitchPrompt" for this premium Australian business website.

Business: ${businessName}
Industry: ${industry}
Location: ${businessAddress}
USP: ${usp}
Audience: ${targetAudience}
Goal: ${goal}
Type: ${siteType === 'multi' ? 'Multi-page' : 'Single page'}
Pages: ${pages.join(', ')}
Features: ${features.join(', ')}
Style: ${style || 'Modern professional'}
Colours: ${colorPrefs || 'Not specified'}
References: ${references || 'None'}
Logo: ${hasLogo}
Pricing: ${hasPricing === 'Yes' ? pricingType : 'None'}
${pricingContext ? `Pricing data:\n${pricingContext}` : ''}

The stitchPrompt MUST specify:
1. Full-viewport hero: bold 60-80px headline, distinctive non-white background (use gradient, image, or dark overlay), strong CTA button
2. Sticky nav with hamburger (id="hamburger") toggling mobile menu (id="mobile-menu")  
3. Mixed asymmetric section layouts - NO generic card grids
4. Specific font pairing and colour hex values based on preferences
5. Stats bar with trust signals (years, clients, rating)
6. ${siteType === 'multi' ? 'Each page as <div data-page="pagename"> — first visible, rest hidden' : 'Smooth scroll single page'}
7. Real-looking placeholder contact details (replace later)
8. Industry-specific premium design — research competitors and be unique

Return ONLY valid JSON: {"projectTitle":"...","stitchPrompt":"..."}`
      }]
    });

    let projectTitle = `${businessName} Website`;
    let stitchPrompt = "";
    try {
      const text = pass1.content[0].type === 'text' ? pass1.content[0].text : '{}';
      const parsed = JSON.parse(text);
      projectTitle = parsed.projectTitle || projectTitle;
      stitchPrompt = parsed.stitchPrompt || "";
    } catch {
      const text = pass1.content[0].type === 'text' ? pass1.content[0].text : '';
      const m = text.match(/"stitchPrompt"\s*:\s*"([\s\S]+?)"\s*\}/);
      stitchPrompt = m ? m[1] : text;
    }

    // ── Stitch ──────────────────────────────────────────────────────────────

    let rawHtml = `<!DOCTYPE html><html><head><title>${businessName}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>${businessName}</h1></body></html>`;
    try {
      const { StitchClient } = await import("@/lib/stitch");
      const stitch = new StitchClient(process.env.STITCH_API_KEY!);
      const project = await stitch.createProject({ title: projectTitle });
      const screen = await stitch.generateScreen(project.id, stitchPrompt);
      if (screen.downloadUrl) {
        const r = await fetch(screen.downloadUrl);
        rawHtml = await r.text();
      }
    } catch (e) {
      console.error("Stitch error:", e);
    }

    // ── Claude pass 2: fix HTML + inject embeds ──────────────────────────────

    const pass2 = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `You are a senior web developer. Fix this generated HTML and inject all integration embed codes. Return ONLY the complete fixed HTML with no markdown, no explanation.

REAL BUSINESS DETAILS (replace ALL placeholders):
- Business: ${businessName}
- Phone: ${phone}
- Email: ${email}
- Address: ${businessAddress}
- Industry: ${industry}

REQUIRED FIXES:
1. Replace every placeholder (lorem ipsum, "Your Business", "example@email.com", "555-0000", "Your City") with real details
2. Fix dead href="#" links - connect to real page sections via data-nav attributes
3. ${siteType === 'multi' ? 'Ensure pages use <div data-page="pagename"> — first visible, rest hidden via inline style' : 'Ensure anchor links work'}
4. CTA buttons must do something - link to contact, booking, or form sections
5. hamburger must have id="hamburger", mobile menu id="mobile-menu"
6. Add proper meta title and description tags
7. Ensure mobile responsive

${embedSummary}

ORIGINAL HTML:
${rawHtml}`
      }]
    });

    let fixedHtml = pass2.content[0].type === 'text' ? pass2.content[0].text : rawHtml;
    fixedHtml = fixedHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');

    // ── Post-processing ──────────────────────────────────────────────────────

    const linkReport = checkLinks(fixedHtml);
    let finalHtml = injectEssentials(fixedHtml);
    finalHtml = injectImages(finalHtml, logoUrl, heroUrl, photoUrls.filter(Boolean), productPhotoMap.filter(Boolean));
    const htmlWithWatermark = injectWatermark(finalHtml);
    const cssContent = extractCSS(finalHtml);

    // ── Deploy to Vercel ─────────────────────────────────────────────────────

    const previewUrl = await deployToVercel(jobId, htmlWithWatermark);

    // ── Save to Redis ────────────────────────────────────────────────────────

    const processSecret = process.env.PROCESS_SECRET || "webgecko";
    const processUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/process?jobId=${jobId}&secret=${processSecret}`;

    await redis.set(`job:${jobId}`, JSON.stringify({
      jobId, businessName, industry, name, email, phone, abn, businessAddress,
      goal, siteType, pages, features, quote, integrations, previewUrl,
      html: finalHtml, linkReport, payment_status: "pending",
      created_at: new Date().toISOString(),
    }), { ex: 60 * 60 * 24 * 7 }); // 7 day TTL

    // ── Send emails ──────────────────────────────────────────────────────────

    const safeName = businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    await Promise.allSettled([
      resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: process.env.RESULT_TO_EMAIL!,
        subject: `New Job: ${businessName} — ${quote.packageName} $${quote.totalPrice.toLocaleString()}`,
        html: buildOwnerEmail({ jobId, businessName, name, email, phone, abn, businessAddress, industry, goal, siteType, pages, features, quote, integrations, previewUrl, linkReport, processUrl }),
        attachments: [
          { filename: `${safeName}.html`, content: Buffer.from(finalHtml).toString("base64") },
          { filename: `${safeName}-styles.css`, content: Buffer.from(cssContent).toString("base64") },
        ],
      }),
      resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: email,
        subject: `Your ${businessName} website is being built!`,
        html: buildClientEmail({ businessName, name, email, pages, features, quote }),
      }),
    ]);

    return NextResponse.json({ success: true, jobId, previewUrl });

  } catch (error: any) {
    console.error("Worker error:", error);
    return NextResponse.json({ error: "Processing failed", details: error.message }, { status: 500 });
  }
}
