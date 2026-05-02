// app/api/admin/seed-test-job/route.ts
// Creates/resets a permanent test job so you can retrigger builds without re-entering intake.
// GET /api/admin/seed-test-job?secret=PROCESS_SECRET        => seed only
// GET /api/admin/seed-test-job?secret=PROCESS_SECRET&trigger=1 => seed + trigger build

import { NextRequest } from "next/server";
import { saveJob, saveClient } from "@/lib/db";
import { inngest } from "@/lib/inngest";

const TEST_JOB_ID = "job_test_webgecko_dev";
const TEST_SLUG   = "testbusiness-dev";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.PROCESS_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  const trigger = searchParams.get("trigger") === "1";

  const userInput = {
    businessName: "Test Business Dev",
    industry: "Plumbing",
    targetAudience: "Homeowners in Brisbane",
    usp: "Fast same-day service",
    goal: "Get more bookings",
    style: "Modern dark",
    colorPrefs: "Dark navy and green",
    references: "",
    features: ["Booking System", "Photo Gallery", "Live Chat"],
    email: "test@testbusiness.com.au",
    phone: "0412 345 678",
    businessAddress: "123 Test Street, Brisbane QLD 4000",
    facebookPage: "",
    additionalNotes: "Dev test job -- retrigger freely",
    pages: ["Home", "About", "Services", "Booking", "Contact"],
    siteType: "multi",
    hasPricing: "No",
    pricingMethod: "manual",
    domain: "testbusiness.com.au",
    ga4Id: "",
    existingBookingUrl: "",
  };

  await saveJob(TEST_JOB_ID, {
    status: "awaiting_payment",
    fileName: "testbusiness-dev",
    userInput,
    logoUrl: null,
    heroUrl: null,
    photoUrls: [],
    productsWithPhotos: [],
    hasBooking: true,
    clientSlug: TEST_SLUG,
  });

  await saveClient(TEST_SLUG, {
    job_id: TEST_JOB_ID,
    business_name: userInput.businessName,
    email: userInput.email,
    phone: userInput.phone,
    industry: userInput.industry,
    domain: userInput.domain,
    password: "testpass123",
    metadata: {},
  });

  if (trigger) {
    await inngest.send({ name: "build/website", data: { jobId: TEST_JOB_ID } });
  }

  const base = new URL(req.url).origin;
  const triggerUrl = `${base}/api/pipeline/run?jobId=${TEST_JOB_ID}&secret=${process.env.PROCESS_SECRET}`;
  const portalUrl  = `${base}/c/${TEST_SLUG}`;
  const seedAndGo  = `${base}/api/admin/seed-test-job?secret=${searchParams.get("secret")}&trigger=1`;

  const html = [
    "<!DOCTYPE html><html><body style='font-family:sans-serif;background:#0f172a;color:white;padding:40px;max-width:640px;margin:0 auto;'>",
    `<h1 style='color:#22c55e'>${trigger ? "Seeded + Triggered" : "Seeded"}</h1>`,
    "<table style='width:100%;border-collapse:collapse;margin:16px 0;'>",
    `<tr><td style='padding:8px;color:#64748b;'>Job ID</td><td><code style='background:#1e293b;padding:4px 8px;border-radius:4px;'>${TEST_JOB_ID}</code></td></tr>`,
    `<tr><td style='padding:8px;color:#64748b;'>Slug</td><td><code style='background:#1e293b;padding:4px 8px;border-radius:4px;'>${TEST_SLUG}</code></td></tr>`,
    "<tr><td style='padding:8px;color:#64748b;'>Password</td><td><code style='background:#1e293b;padding:4px 8px;border-radius:4px;'>testpass123</code></td></tr>",
    "<tr><td style='padding:8px;color:#64748b;'>Pages</td><td><code style='background:#1e293b;padding:4px 8px;border-radius:4px;'>Home, About, Services, Booking, Contact</code></td></tr>",
    "<tr><td style='padding:8px;color:#64748b;'>Type</td><td><code style='background:#1e293b;padding:4px 8px;border-radius:4px;'>multi-page + SuperSaas booking</code></td></tr>",
    "</table>",
    "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;'>",
    `<a href='${triggerUrl}' style='background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;'>Trigger Build</a>`,
    `<a href='${portalUrl}' style='background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;'>Client Portal</a>`,
    `<a href='${seedAndGo}' style='background:#8b5cf6;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;'>Reset + Build</a>`,
    "</div>",
    "<hr style='border-color:#1e293b;margin:32px 0;'>",
    "<p style='color:#475569;font-size:13px;'>Bookmark <strong>Reset + Build</strong> to wipe the test job and start a fresh build in one click.</p>",
    "</body></html>",
  ].join("\n");

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
