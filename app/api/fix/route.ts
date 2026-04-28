import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 300;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function deployToVercel(html: string, projectName: string): Promise<{ url: string }> {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50);
  const uniqueName = `${safeName}-fix-${Date.now()}`;

  const resp = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: uniqueName,
      teamId: process.env.VERCEL_TEAM_ID,
      files: [{ file: "index.html", data: html, encoding: "utf-8" }],
      projectSettings: { framework: null, outputDirectory: "./" },
    }),
  });

  if (!resp.ok) throw new Error(`Vercel deploy failed: ${await resp.text()}`);
  const data = await resp.json();
  return { url: `https://${data.url}` };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("id") || url.searchParams.get("jobId");
  const secret = url.searchParams.get("secret");

  if (!jobId || !secret) {
    return new Response("Missing jobId or secret", { status: 400 });
  }

  if (secret !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  // Load job from Redis
  const job = await redis.get<any>(`job:${jobId}`) || await redis.get<any>(jobId!);
  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  console.log(`🔧 Fix-it triggered for job: ${jobId} — ${job.businessName}`);

  try {
    // Re-run Claude pass 2 on the stored HTML
    const pass2 = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `You are an expert frontend developer. Fix and significantly improve this HTML website for ${job.businessName}.

BUSINESS DETAILS:
- Name: ${job.businessName}
- Industry: ${job.industry}
- Email: ${job.email}
- Phone: ${job.phone}
- Goal: ${job.goal}
- Pages: ${(job.pages || []).join(", ")}
- Features: ${(job.features || []).join(", ")}

TASKS:
1. Replace ALL placeholder text with real, compelling business content
2. Fix any broken layout or invisible content (check for black-on-black text)
3. Ensure the hero section is full viewport height with large visible headline
4. Make sure all sections are visible and styled properly
5. Fix navigation hamburger menu
6. Add proper meta tags
7. Ensure mobile responsiveness
8. Make the design premium and distinctive

CURRENT HTML TO FIX:
${job.html || "No HTML found — generate a complete website from scratch for this business."}

Return ONLY the complete fixed HTML document starting with <!DOCTYPE html>. No explanations, no markdown, no backticks.`,
        },
      ],
    });

    const fixedText = pass2.content.find((b) => b.type === "text")?.text || "";
    let fixedHtml = fixedText.trim();

    if (!fixedHtml.includes("<!DOCTYPE") && !fixedHtml.includes("<html")) {
      throw new Error("Claude did not return valid HTML");
    }

    // Add watermark
    const watermark = `
<div style="position:fixed;bottom:12px;right:12px;z-index:9999;opacity:0.7;">
  <a href="https://webgecko.au" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;text-decoration:none;background:rgba(10,15,26,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 12px;backdrop-filter:blur(8px);">
    <span style="font-size:14px;">🦎</span>
    <span style="color:#ffffff;font-size:11px;font-family:sans-serif;font-weight:600;letter-spacing:0.03em;">Built by WebGecko</span>
  </a>
</div>`;
    fixedHtml = fixedHtml.replace("</body>", `${watermark}\n</body>`);

    // Deploy
    const { url: newPreviewUrl } = await deployToVercel(fixedHtml, `${job.businessName}-fixed`);
    console.log(`✅ Fixed site deployed: ${newPreviewUrl}`);

    // Update client portal previewUrl
    const clientSlug = job.fileName || job.userInput?.businessName?.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    if (clientSlug) {
      try {
        const existingClient = await redis.get<any>(`client:${clientSlug}`);
        if (existingClient) {
          await redis.set(`client:${clientSlug}`, { ...existingClient, previewUrl: newPreviewUrl });
        }
      } catch {}
    }

    // Update Redis
    await redis.set(jobId!, { ...job, html: fixedHtml, previewUrl: newPreviewUrl, fixedAt: new Date().toISOString() }, { ex: 60 * 60 * 24 * 30 });
    // Also update client portal with preview URL
    if (job.userInput?.businessName) {
      const slug = job.userInput.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
      const clientData = await redis.get<any>(`client:${slug}`);
      if (clientData) {
        await redis.set(`client:${slug}`, { ...clientData, previewUrl: newPreviewUrl });
      }
    }

    // Send updated owner email with new HTML attached
    try {
      const ownerEmail = process.env.RESULT_TO_EMAIL || "hello@webgecko.au";
      await resend.emails.send({
        from: "WebGecko Pipeline <pipeline@webgecko.au>",
        to: ownerEmail,
        subject: `✅ Fixed: ${job.businessName} — New Preview Ready`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:#f59e0b;padding:24px 32px;">
          <h1 style="margin:0;color:#000;font-size:22px;">🔧 Fix-It Complete</h1>
          <p style="margin:4px 0 0;color:rgba(0,0,0,0.7);font-size:14px;">Re-run pass 2 for ${job.businessName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#e2e8f0;margin:0 0 20px;">The fix-it pipeline has completed. A new improved version has been deployed.</p>
          <p style="color:#64748b;margin:0 0 8px;font-size:13px;">Job ID: ${jobId}</p>
          <div style="text-align:center;margin-top:24px;">
            <a href="${newPreviewUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">View Fixed Website →</a>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin-top:12px;">📎 Updated HTML file attached</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        attachments: [
          {
            filename: `${job.businessName.replace(/[^a-zA-Z0-9]/g, "-")}-FIXED.html`,
            content: Buffer.from(fixedHtml).toString("base64"),
          },
        ],
      });
    } catch (emailErr) {
      console.error("Fix-it email failed:", emailErr);
    }

    // Return a nice success page
    return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Fix Complete</title>
<style>
  body { margin: 0; background: #0a0f1a; color: #e2e8f0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #0f1623; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; max-width: 480px; text-align: center; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { color: #10b981; margin: 0 0 8px; }
  p { color: #94a3b8; margin: 0 0 24px; }
  a { display: inline-block; background: #10b981; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Fix Complete!</h1>
    <p>${job.businessName} has been re-processed. New HTML file sent to your email.</p>
    <a href="${newPreviewUrl}" target="_blank">View Fixed Site →</a>
  </div>
</body>
</html>`, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

  } catch (err) {
    console.error("Fix-it error:", err);
    return new Response(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 });
  }
}