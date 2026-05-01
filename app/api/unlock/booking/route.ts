// app/api/unlock/booking/route.ts
// Admin unlocks booking system for a client — and emails them.
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getServicesForIndustry } from "@/lib/pipeline-helpers";
import { getJob, saveJob, getClient, saveClient, getAvailability, saveAvailability } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Update job
    await saveJob(jobId, { ...job, hasBooking: true });

    // Update client record
    if (job.clientSlug) {
      const client = await getClient(job.clientSlug);
      if (client) await saveClient(job.clientSlug, { ...client, has_booking: true });
    }

    // Create availability config if missing
    const existingAvail = await getAvailability(jobId);
    if (!existingAvail) {
      const userInput = job.userInput || {};
      const industry = userInput.industry || "";
      await saveAvailability(jobId, {
        businessName: userInput.businessName || "Business",
        clientEmail: job.userInput?.email || "",
        timezone: "Australia/Brisbane",
        days: [1, 2, 3, 4, 5],
        startHour: 9,
        endHour: 17,
        slotDurationMinutes: 60,
        bufferMinutes: 15,
        maxDaysAhead: 30,
        services: getServicesForIndustry(industry),
      });
    }

    // Email the client
    const clientEmail = job.userInput?.email || "";
    const businessName = job.userInput?.businessName || "your website";
    const clientSlug = job.clientSlug || "";
    const portalUrl = `https://webgecko-builder.vercel.app/c/${clientSlug}`;

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
    <p style="color:#e2e8f0;margin:0 0 16px;">Your online booking system for <strong style="color:#8b5cf6;">${businessName}</strong> is now active. Customers can book appointments directly from your site.</p>
    <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#0099ff);color:#fff;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;">View My Bookings →</a>
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="color:#475569;font-size:12px;margin:0;">Sent by WebGecko · hello@webgecko.au</p>
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
