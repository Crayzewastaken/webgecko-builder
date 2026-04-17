export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { stitchClient } from "@/lib/stitch";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

// Inject JS directly — no Claude needed
function injectInteractions(html: string): string {
  const script = `
<script>
document.addEventListener('DOMContentLoaded', function() {

  // HAMBURGER / MOBILE MENU
  const toggles = document.querySelectorAll('[class*="hamburger"],[class*="menu-toggle"],[class*="nav-toggle"],[class*="burger"],[aria-label*="menu"],[aria-label*="Menu"]');
  const navMenus = document.querySelectorAll('[class*="mobile-menu"],[class*="nav-menu"],[class*="mobile-nav"],[class*="sidebar"]');
  toggles.forEach(btn => {
    btn.addEventListener('click', function() {
      navMenus.forEach(menu => {
        menu.style.display = menu.style.display === 'none' || menu.style.display === '' ? 'block' : 'none';
      });
    });
  });

  // SMOOTH SCROLL for all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // close mobile menu if open
        navMenus.forEach(menu => { menu.style.display = 'none'; });
      }
    });
  });

  // NAV LINKS — if they point to missing pages, redirect to sections
  document.querySelectorAll('nav a, header a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.endsWith('.html') || (href.startsWith('/') && !href.startsWith('/#'))) {
      link.addEventListener('click', function(e) {
        const pageName = href.replace('.html','').replace('/','').toLowerCase();
        const section = document.getElementById(pageName) || document.querySelector('[class*="' + pageName + '"]');
        if (section) {
          e.preventDefault();
          section.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  });

  // CTA BUTTONS — scroll to contact/booking section
  document.querySelectorAll('button, [class*="btn"], [class*="cta"]').forEach(btn => {
    const text = (btn.textContent || '').toLowerCase();
    if (text.includes('contact') || text.includes('consult') || text.includes('book') || text.includes('get started') || text.includes('quote')) {
      btn.addEventListener('click', function() {
        const contact = document.querySelector('#contact, [class*="contact"], form, #booking, [class*="booking"]');
        if (contact) contact.scrollIntoView({ behavior: 'smooth' });
      });
    }
    if (text.includes('learn more') || text.includes('explore') || text.includes('view') || text.includes('see our')) {
      btn.addEventListener('click', function() {
        const next = document.querySelector('#services, #gallery, #shop, #portfolio, [class*="services"], [class*="gallery"]');
        if (next) next.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });

  // FORMS — show success message on submit
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const msg = document.createElement('div');
      msg.style.cssText = 'background:#22c55e;color:white;padding:16px;border-radius:8px;margin-top:12px;font-weight:bold;';
      msg.textContent = 'Thank you! We will be in touch shortly.';
      form.appendChild(msg);
    });
  });

  // MODALS — find modal triggers and targets
  document.querySelectorAll('[data-modal],[data-target],[data-toggle]').forEach(trigger => {
    trigger.addEventListener('click', function() {
      const target = document.querySelector(this.dataset.modal || this.dataset.target || this.dataset.toggle);
      if (target) target.style.display = target.style.display === 'none' ? 'block' : 'none';
    });
  });

});
</script>`;

  // Insert before closing body tag
  if (html.includes('</body>')) {
    return html.replace('</body>', script + '</body>');
  }
  return html + script;
}

export async function POST(req: Request) {
  try {
    const userInput = await req.json();
    console.log("REQUEST RECEIVED");

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";

    console.log("STEP 1: Calling Claude for spec...");
    const promptResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Return ONLY valid JSON:
{
  "projectTitle": "string",
  "stitchPrompt": "string"
}

Generate a premium Stitch website prompt for this brief:
${JSON.stringify(userInput)}

Pages: ${pageList}
Goal: ${userInput.goal || "generate leads"}
Style: ${userInput.style || "modern premium"}
Features: ${Array.isArray(userInput.features) ? userInput.features.join(", ") : "contact form"}`
      }]
    });

    const text = promptResponse.content[0]?.type === "text" ? promptResponse.content[0].text : "{}";
    const spec = extractJson(text);
    console.log("STEP 1 DONE:", spec.projectTitle);

    console.log("STEP 2: Creating Stitch project...");
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

    // STEP 5: Inject interactions via code (instant, no Claude needed)
    const finalHtml = injectInteractions(stitchHtml);
    console.log("STEP 5 DONE. Final length:", finalHtml.length);

    console.log("STEP 6: Sending email...");
    const emailResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `Website - ${spec.projectTitle}`,
      html: "<p>Your website is attached.</p>",
      attachments: [{ filename: "site.html", content: Buffer.from(finalHtml).toString("base64") }],
    });
    console.log("STEP 6 DONE:", JSON.stringify(emailResult));

    return NextResponse.json({ success: true, message: "Website sent to your email!" });

  } catch (error: any) {
    console.error("FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}