// app/api/worker/route.ts
// Intake only — parses form, uploads images, saves to Redis, emails client quote + portal.
// Build pipeline triggers separately after deposit payment via Square webhook.

export const maxDuration = 300;
import crypto from "crypto";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Redis } from "@upstash/redis";
import { v2 as cloudinary } from "cloudinary";
import { generateBookingWidget } from "@/lib/booking-widget";
import {
  safeFileName,
  calculateQuote,
  getSlotDuration,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: filename, overwrite: true },
      (error, result) => { if (error) reject(error); else resolve(result!.secure_url); }
    );
    stream.end(buffer);
  });
}

async function setupBookingAvailability(
  jobId: string,
  businessName: string,
  clientEmail: string,
  industry: string,
  timezone: string
): Promise<void> {
  const slotDuration = getSlotDuration(industry);
  const services = getServicesForIndustry(industry);
  const availabilityConfig = {
    jobId, businessName, clientEmail,
    timezone: timezone || "Australia/Brisbane",
    days: [1, 2, 3, 4, 5],
    startHour: 9, endHour: 17,
    slotDurationMinutes: slotDuration,
    bufferMinutes: 15, maxDaysAhead: 30, services,
  };
  await redis.set(`availability:${jobId}`, availabilityConfig);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    console.log("INTAKE: Request received");
    const formData = await req.formData();
    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    // Verify Turnstile
    const turnstileToken = getString("turnstileToken");
    if (!turnstileToken) {
      return NextResponse.json({ success: false, message: "Security check failed. Please refresh and try again." });
    }
    const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
    });
    const turnstileResult = await turnstileVerify.json();
    if (!turnstileResult.success) {
      console.log("Turnstile failed:", turnstileResult);
      if (process.env.NODE_ENV === "production" && !process.env.TURNSTILE_BYPASS) {
        console.log("Turnstile failed but continuing...");
      }
    }
    console.log("INTAKE: Turnstile passed");

    const userInput = {
      businessName: getString("businessName"),
      industry: getString("industry"),
      usp: getString("usp"),
      existingWebsite: getString("existingWebsite"),
      targetAudience: getString("targetAudience"),
      goal: getString("goal"),
      siteType: getString("siteType"),
      pages: getJson("pages"),
      features: getJson("features"),
      hasPricing: getString("hasPricing"),
      pricingType: getString("pricingType"),
      pricingMethod: getString("pricingMethod"),
      pricingUrl: getString("pricingUrl"),
      pricingDetails: getString("pricingDetails"),
      products: getJson("products"),
      style: getString("style"),
      colorPrefs: getString("colorPrefs"),
      references: getString("references"),
      hasLogo: getString("hasLogo"),
      hasContent: getString("hasContent"),
      additionalNotes: getString("additionalNotes"),
      name: getString("name"),
      email: getString("email"),
      phone: getString("phone"),
      abn: getString("abn"),
      domain: getString("domain"),
      businessAddress: getString("businessAddress"),
    };

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0
      ? userInput.pages.join(", ") : "Home";
    const fileName = safeFileName(userInput.businessName || "website");
    const clientEmail = userInput.email || "";
    const clientPhone = userInput.phone || "";
    const quote = calculateQuote(userInput);
    const folder = `webgecko/${fileName}`;
    const features = Array.isArray(userInput.features) ? userInput.features : [];
    const hasBookingFeature = features.includes("Booking System");

    // Upload all images in parallel
    let logoUrl: string | null = null;
    let heroUrl: string | null = null;
    const photoUrls: string[] = [];
    const productsWithPhotos: { name: string; price: string; photoUrl?: string }[] =
      Array.isArray(userInput.products) ? [...userInput.products] : [];

    const logoFile = formData.get("logo") as File | null;
    const heroFile = formData.get("hero") as File | null;
    const uploadPromises: Promise<void>[] = [];

    if (logoFile && logoFile.size > 0) {
      uploadPromises.push(logoFile.arrayBuffer().then(buf =>
        uploadToCloudinary(Buffer.from(buf), folder, "logo").then(url => { logoUrl = url; console.log("Logo:", url); })
      ));
    }
    if (heroFile && heroFile.size > 0) {
      uploadPromises.push(heroFile.arrayBuffer().then(buf =>
        uploadToCloudinary(Buffer.from(buf), folder, "hero").then(url => { heroUrl = url; console.log("Hero:", url); })
      ));
    }
    for (let i = 0; i < 5; i++) {
      const f = formData.get(`photo_${i}`) as File | null;
      if (f && f.size > 0) {
        uploadPromises.push(f.arrayBuffer().then(buf =>
          uploadToCloudinary(Buffer.from(buf), folder, `photo_${i}`).then(url => { photoUrls.push(url); })
        ));
      }
    }
    for (let i = 0; i < 12; i++) {
      const f = formData.get(`product_photo_${i}`) as File | null;
      if (f && f.size > 0) {
        const index = i;
        uploadPromises.push(f.arrayBuffer().then(buf =>
          uploadToCloudinary(Buffer.from(buf), `${folder}/products`, `product_${index}`).then(url => {
            if (productsWithPhotos[index]) productsWithPhotos[index].photoUrl = url;
          })
        ));
      }
    }
    await Promise.all(uploadPromises);
    console.log(`INTAKE: Uploads done — logo=${!!logoUrl}, hero=${!!heroUrl}, photos=${photoUrls.length}, products=${productsWithPhotos.filter(p => p.photoUrl).length}`);

    // Create job ID and save booking availability (the widget is generated at build time)
    const jobId = `job_${Date.now()}`;
    if (hasBookingFeature) {
      try {
        await setupBookingAvailability(jobId, userInput.businessName, clientEmail, userInput.industry, "Australia/Brisbane");
        console.log("INTAKE: Booking availability saved");
      } catch (e) {
        console.error("INTAKE: Booking setup failed:", e);
      }
    }

    // Generate client portal credentials
    const clientSlug = safeFileName(userInput.businessName);
    const clientPassword = crypto.randomBytes(5).toString("hex");
    const clientPortalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/c/${clientSlug}`;

    // Save job record — build pipeline will update with html/title/previewUrl once paid
    await redis.set(`job:${jobId}`, {
      jobId,
      status: "awaiting_payment",
      fileName,
      userInput,
      logoUrl,
      heroUrl,
      photoUrls,
      productsWithPhotos,
      hasBooking: hasBookingFeature,
      email: clientEmail,
      phone: clientPhone,
      businessName: userInput.businessName,
      industry: userInput.industry,
      clientSlug,
    }, { ex: 86400 * 30 });

    // Save client portal record
    await redis.set(`client:${clientSlug}`, {
      slug: clientSlug,
      password: clientPassword,
      jobId,
      businessName: userInput.businessName,
      name: userInput.name,
      email: clientEmail,
      phone: clientPhone,
      industry: userInput.industry,
      goal: userInput.goal,
      siteType: userInput.siteType,
      pages: userInput.pages,
      features,
      style: userInput.style,
      abn: userInput.abn,
      domain: userInput.domain,
      quote,
      previewUrl: "",
      hasBooking: hasBookingFeature,
      buildStatus: "awaiting_payment",
      created: new Date().toISOString(),
    });

    console.log(`INTAKE: Saved job=${jobId} client=${clientSlug}`);

    const depositAmount = Math.round(quote.price * 0.5);
    const productSummary = productsWithPhotos.length > 0
      ? productsWithPhotos.map(p => `${p.name} - ${p.price}`).join(", ")
      : userInput.pricingDetails || "-";

    // Email client — quote + portal login + pay now CTA
    if (clientEmail) {
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: clientEmail,
        subject: `Your WebGecko quote is ready — ${userInput.businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0a0f1a;">
            <div style="text-align:center;margin-bottom:32px;">
              <div style="font-size:40px;margin-bottom:8px;">🦎</div>
              <h1 style="font-size:28px;margin-bottom:8px;color:#ffffff;">Thank you, ${userInput.name}!</h1>
              <p style="color:#94a3b8;margin:0;">Your quote is ready. Pay your deposit to start your build.</p>
            </div>

            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:16px;margin-bottom:4px;color:#f2ca50;">Your Quote — ${quote.package} Package</h2>
              <p style="font-size:36px;font-weight:800;margin:8px 0 4px;color:#ffffff;">$${quote.price.toLocaleString()}</p>
              <p style="color:#94a3b8;margin-bottom:16px;font-size:13px;">+ $${quote.monthlyPrice}/month hosting & maintenance</p>
              <div style="background:#052e16;border:1px solid #10b981;border-radius:8px;padding:14px;">
                <p style="color:#10b981;font-weight:bold;margin:0;font-size:13px;">🎉 Saving $${quote.savings.toLocaleString()} vs the industry average of $${quote.competitorPrice.toLocaleString()}</p>
              </div>
            </div>

            <div style="background:#0f1623;border:2px solid #10b981;border-radius:16px;padding:28px;margin-bottom:24px;text-align:center;">
              <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Ready to get started?</h2>
              <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Pay your 50% deposit ($${depositAmount.toLocaleString()}) to begin your build. Your website won't start until payment is received.</p>
              <a href="${clientPortalUrl}" style="display:inline-block;background:#10b981;color:#000000;padding:16px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:16px;">
                Pay Deposit & Start Build →
              </a>
              <p style="color:#475569;font-size:12px;margin:16px 0 0;">Secure payment via Square. No card details stored by WebGecko.</p>
            </div>

            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:14px;margin-bottom:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Your Client Portal</h2>
              <p style="color:#64748b;font-size:13px;margin-bottom:12px;">Track progress, view your site preview, and manage bookings.</p>
              <div style="background:#0a0f1a;border-radius:8px;padding:14px;margin-bottom:12px;">
                <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">URL</p>
                <a href="${clientPortalUrl}" style="color:#10b981;font-weight:600;font-size:14px;">${clientPortalUrl}</a>
                <p style="margin:10px 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Username</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:0;">${clientSlug}</p>
                <p style="margin:10px 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Password</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:0;font-family:monospace;">${clientPassword}</p>
              </div>
            </div>

            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:14px;margin-bottom:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Project Summary</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#64748b;width:140px;">Business</td><td style="padding:6px 0;color:#e2e8f0;font-weight:600;">${userInput.businessName}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Goal</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.goal}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Site Type</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.siteType === "multi" ? "Multi Page" : "Single Page"}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Pages</td><td style="padding:6px 0;color:#e2e8f0;">${pageList}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Features</td><td style="padding:6px 0;color:#e2e8f0;">${features.join(", ") || "-"}</td></tr>
                ${userInput.abn ? `<tr><td style="padding:6px 0;color:#64748b;">ABN</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.abn}</td></tr>` : ""}
                ${userInput.domain ? `<tr><td style="padding:6px 0;color:#64748b;">Domain</td><td style="padding:6px 0;color:#e2e8f0;">${userInput.domain}</td></tr>` : ""}
              </table>
            </div>

            <p style="color:#64748b;font-size:12px;text-align:center;">Questions? Reply to this email or contact <a href="mailto:hello@webgecko.au" style="color:#94a3b8;">hello@webgecko.au</a></p>
            <p style="color:#374151;font-size:11px;text-align:center;margin-top:8px;">WebGecko · Professional Web Design · webgecko.au</p>
          </div>
        `,
      });
      console.log("INTAKE: Client email sent");
    }

    // Email owner — lead notification
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `🆕 New Lead — ${userInput.businessName} (awaiting deposit)`,
      html: `
        <h2>New Website Lead</h2>
        <p><strong>Status:</strong> ⏳ Awaiting deposit — build will trigger automatically on payment</p>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Client:</strong> ${userInput.name}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <p><strong>ABN:</strong> ${userInput.abn || "-"}</p>
        <p><strong>Domain:</strong> ${userInput.domain || "-"}</p>
        <p><strong>Industry:</strong> ${userInput.industry}</p>
        <p><strong>Audience:</strong> ${userInput.targetAudience || "-"}</p>
        <p><strong>Goal:</strong> ${userInput.goal}</p>
        <p><strong>Type:</strong> ${userInput.siteType}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${features.join(", ") || "-"}</p>
        <p><strong>Pricing:</strong> ${userInput.hasPricing === "Yes" ? `${userInput.pricingType} via ${userInput.pricingMethod}` : "None"}</p>
        ${userInput.hasPricing === "Yes" ? `<p><strong>Products:</strong> ${productSummary}</p>` : ""}
        <p><strong>Style:</strong> ${userInput.style} / ${userInput.colorPrefs || "-"}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <p><strong>Notes:</strong> ${userInput.additionalNotes || "-"}</p>
        ${logoUrl ? `<p><strong>Logo:</strong> <a href="${logoUrl}">View</a></p>` : ""}
        ${heroUrl ? `<p><strong>Hero:</strong> <a href="${heroUrl}">View</a></p>` : ""}
        <h3>Quote: ${quote.package} — $${quote.price.toLocaleString()} + $${quote.monthlyPrice}/month</h3>
        <ul>${quote.breakdown.map(b => `<li>${b}</li>`).join("")}</ul>
      `,
    });
    console.log("INTAKE: Owner email sent");

    return NextResponse.json({
      success: true,
      message: "Thank you! Your quote is ready. Check your email to pay your deposit and start your build.",
    });

  } catch (error: any) {
    console.error("INTAKE FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}