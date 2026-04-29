// app/api/unlock/booking/route.ts
// Admin unlocks booking system for a client — and emails them.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { getServicesForIndustry } from "@/lib/pipeline-helpers";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const job = await redis.get<any>(`job:${jobId}`);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Update job
    await redis.set(`job:${jobId}`, { ...job, hasBooking: true, bookingUnlockedAt: new Date().toISOString() });

    // Update client record
    const clientSlug = job.clientSlug || job.fileName;
    if (clientSlug) {
      const client = await redis.get<any>(`client:${clientSlug}`);
      if (client) {
        await redis.set(`client:${clientSlug}`, { ...client, hasBooking: true });
      }
    }

    // Create availability config if it doesn't exist yet
    // (happens when booking is unlocked after site build, not at intake time)
    const existingAvailability = await redis.get(`availability:${jobId}`);
    if (!existingAvailability) {
      const userInput = job.userInput || {};
      const clientEmail = job.email || userInput.email || "";
      const businessName = userInput.businessName || "Business";
      const industry = userInput.industry || "";
      const services = getServicesForIndustry(industry);
      const availabilityConfig = {
        jobId,
        businessName,
        clientEmail,
        timezone: "Australia/Brisbane",
        days: [1, 2, 3, 4, 5],
        startHour: 9,
        endHour: 17,
        slotDurationMinutes: 60,
        bufferMinutes: 15,
        maxDaysAhead: 30,
        services,
      };
      await redis.set(`availability:${jobId}`, availabilityConfig);
      console.log(`[Unlock Booking] Created availability config for job ${jobId}`);
    }

    // Email the client
    const clientEmail = job.email || "";
    const businessName = job.userInput?.businessName || "your website";
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au";
    const portalUrl = `${base}/c/${clientSlug}`;

    if (clientEmail) {
      try {
        await resend.emails.send({
          from: "WebGecko <hello@webgecko.au>",
          to: clientEmail,
          subject: `Your Online Booking System is Live — ${businessName}`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#8b5cf6,#0099ff);padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;">Your Booking System is Live!</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="color:#94a3b8;margin:0 0 16px;">Hi there,</p>
    <p style="color:#e2e8f0;margin:0 0 16px;">Great news — your online booking system for <strong style="color:#8b5cf6;">${businessName}</strong> is now active on your website. Customers can book appointments directly from your site.</p>
    <p style="color:#e2e8f0;margin:0 0 24px;">You can manage all your bookings — view, confirm, reschedule, or cancel — from your client portal.</p>
    <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#0099ff);color:#fff;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;">View My Bookings →</a>
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="color:#475569;font-size:12px;margin:0;">Sent by <strong style="color:#8b5cf6;">WebGecko</strong> · hello@webgecko.au</p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
        });
      } catch (e) { console.error("[Unlock Booking] Email failed:", e); }
    }

    return NextResponse.json({ ok: true, message: "Booking system unlocked and client notified" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
