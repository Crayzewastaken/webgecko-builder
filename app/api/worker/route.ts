// app/api/worker/route.ts
// Intake only — parses form, uploads images, saves to Supabase, emails client quote + portal.
// Build pipeline triggers separately after deposit payment via Square webhook.

export const maxDuration = 300;
import crypto from "crypto";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";
import {
  safeFileName,
  calculateQuote,
  getSlotDuration,
  getServicesForIndustry,
} from "@/lib/pipeline-helpers";
import { saveJob, saveClient, saveAvailability } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

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

export async function POST(req: Request) {
  try {
    console.log("INTAKE: Request received");
    const formData = await req.formData();
    const getString = (key: string) => formData.get(key)?.toString() || "";
    const getJson = (key: string) => { try { return JSON.parse(getString(key)); } catch { return []; } };

    // Verify Turnstile
    const turnstileToken = getString("turnstileToken");
    if (turnstileToken) {
      const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
      });
      const turnstileResult = await turnstileVerify.json();
      if (!turnstileResult.success && process.env.NODE_ENV === "production" && !process.env.TURNSTILE_BYPASS) {
        console.log("Turnstile failed:", turnstileResult);
      }
    }

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
      facebookPage: getString("facebookPage"),
      ga4Id: getString("ga4Id"),
    };

    const pageList = Array.isArray(userInput.pages) && userInput.pages.length > 0 ? userInput.pages.join(", ") : "Home";
    const fileName = safeFileName(userInput.businessName || "website");
    const clientEmail = userInput.email || "";
    const clientPhone = userInput.phone || "";
    const quote = calculateQuote(userInput);
    const folder = `webgecko/${fileName}`;
    const features = Array.isArray(userInput.features) ? userInput.features : [];
    const hasBookingFeature = features.includes("Booking System");

    // Upload images
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
        uploadToCloudinary(Buffer.from(buf), folder, "logo").then(url => { logoUrl = url; })
      ));
    }
    if (heroFile && heroFile.size > 0) {
      uploadPromises.push(heroFile.arrayBuffer().then(buf =>
        uploadToCloudinary(Buffer.from(buf), folder, "hero").then(url => { heroUrl = url; })
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
    console.log(`INTAKE: Uploads done — logo=${!!logoUrl}, hero=${!!heroUrl}, photos=${photoUrls.length}`);

    const jobId = `job_${Date.now()}`;
    const clientSlug = safeFileName(userInput.businessName);
    const clientPassword = crypto.randomBytes(5).toString("hex");
    const clientPortalUrl = `https://webgecko-builder.vercel.app/c/${clientSlug}`;

    // Save job to Supabase
    await saveJob(jobId, {
      status: "awaiting_payment",
      fileName,
      userInput,
      logoUrl,
      heroUrl,
      photoUrls,
      productsWithPhotos,
      hasBooking: hasBookingFeature,
      clientSlug,
    });

    // Save client to Supabase
    await saveClient(clientSlug, {
      job_id: jobId,
      business_name: userInput.businessName,
      email: clientEmail,
      phone: clientPhone,
      industry: userInput.industry,
      password: clientPassword,
      domain: userInput.domain || null,
    });

    // Create availability config if booking is requested
    if (hasBookingFeature) {
      try {
        await saveAvailability(jobId, {
          businessName: userInput.businessName,
          clientEmail,
          timezone: "Australia/Brisbane",
          days: [1, 2, 3, 4, 5],
          startHour: 9, endHour: 17,
          slotDurationMinutes: getSlotDuration(userInput.industry),
          bufferMinutes: 15, maxDaysAhead: 30,
          services: getServicesForIndustry(userInput.industry),
        });
      } catch (e) { console.error("INTAKE: Availability setup failed:", e); }
    }

    console.log(`INTAKE: Saved job=${jobId} client=${clientSlug}`);

    const depositAmount = Math.round(quote.price * 0.5);
    const productSummary = productsWithPhotos.length > 0
      ? productsWithPhotos.map(p => `${p.name} - ${p.price}`).join(", ")
      : userInput.pricingDetails || "-";

    // Email client
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
              <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Pay your 50% deposit ($${depositAmount.toLocaleString()}) to begin your build.</p>
              <a href="${clientPortalUrl}" style="display:inline-block;background:#10b981;color:#000000;padding:16px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:16px;">Pay Deposit & Start Build →</a>
            </div>
            <div style="background:#0f1623;border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="font-size:14px;margin-bottom:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Your Client Portal</h2>
              <div style="background:#0a0f1a;border-radius:8px;padding:14px;margin-bottom:12px;">
                <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">URL</p>
                <a href="${clientPortalUrl}" style="color:#10b981;font-weight:600;font-size:14px;">${clientPortalUrl}</a>
                <p style="margin:10px 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">Username</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:0;">${clientSlug}</p>
                <p style="margin:10px 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">Password</p>
                <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:0;font-family:monospace;">${clientPassword}</p>
              </div>
            </div>
          </div>
        `,
      });
      console.log("INTAKE: Client email sent");
    }

    // Email owner
    await resend.emails.send({
      from: "WebGecko <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL!,
      subject: `🆕 New Lead — ${userInput.businessName} (awaiting deposit)`,
      html: `
        <h2>New Website Lead</h2>
        <p><strong>Status:</strong> Awaiting deposit — build will trigger automatically on payment</p>
        <p><strong>Business:</strong> ${userInput.businessName}</p>
        <p><strong>Client:</strong> ${userInput.name}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <p><strong>ABN:</strong> ${userInput.abn || "-"}</p>
        <p><strong>Domain:</strong> ${userInput.domain || "-"}</p>
        <p><strong>Industry:</strong> ${userInput.industry}</p>
        <p><strong>Audience:</strong> ${userInput.targetAudience || "-"}</p>
        <p><strong>Goal:</strong> ${userInput.goal || "-"}</p>
        <p><strong>Type:</strong> ${userInput.siteType || "-"}</p>
        <p><strong>Pages:</strong> ${pageList}</p>
        <p><strong>Features:</strong> ${features.join(", ") || "-"}</p>
        <p><strong>Pricing:</strong> ${userInput.pricingMethod || userInput.pricingDetails || "-"}</p>
        <p><strong>Products:</strong> ${productsWithPhotos.length > 0 ? productsWithPhotos.map(p => `${p.name} - ${p.price}`).join(", ") : "-"}</p>
        <p><strong>Style:</strong> ${userInput.style || "-"}</p>
        <p><strong>References:</strong> ${userInput.references || "-"}</p>
        <p><strong>Notes:</strong> ${userInput.additionalNotes || "-"}</p>
        <p><strong>Address:</strong> ${userInput.businessAddress || "-"}</p>
        <p><strong>Facebook:</strong> ${userInput.facebookPage || "-"}</p>
        <hr/>
        <p><strong>Quote:</strong> ${quote.package} — $${quote.price.toLocaleString()} + $${quote.monthlyPrice}/month</p>
        <ul>${quote.breakdown.map(line => `<li>${line}</li>`).join("")}</ul>
        <hr/>
        ${logoUrl ? `<p><strong>Logo:</strong> <a href="${logoUrl}">View</a></p>` : ""}
        ${heroUrl ? `<p><strong>Hero:</strong> <a href="${heroUrl}">View</a></p>` : ""}
        ${photoUrls.length > 0 ? `<p><strong>Photos:</strong> ${photoUrls.map((u, i) => `<a href="${u}">Photo ${i + 1}</a>`).join(" | ")}</p>` : ""}
        <p><strong>Client Portal:</strong> <a href="${clientPortalUrl}">${clientPortalUrl}</a> (slug: ${clientSlug})</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Thank you! Your quote is ready. Check your email to pay your deposit and start your build.",
    });

  } catch (error: any) {
    console.error("INTAKE FAILED:", error.message);
    return NextResponse.json({ success: false, message: error.message });
  }
}
