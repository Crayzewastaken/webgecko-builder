// app/api/analytics/monthly/route.ts
import { Resend } from "resend";
import { NextRequest } from "next/server";
import { getJob, getAnalyticsCount, getTopPages, getBookingsForJob } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY!);

function buildReportHtml(data: {
  businessName: string; month: string; views: number; bookingClicks: number;
  contactClicks: number; formSubmits: number; totalViews: number; bookingCount: number;
  topPages: { page: string; views: number }[]; previewUrl: string;
}) {
  const monthLabel = new Date(data.month + "-01").toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const conversionRate = data.views > 0 ? ((data.bookingClicks / data.views) * 100).toFixed(1) : "0.0";
  const topPagesHtml = data.topPages.slice(0, 5).map(p =>
    `<tr><td style="padding:10px 16px;color:#e2e8f0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${p.page}</td>
     <td style="padding:10px 16px;color:#10b981;font-weight:700;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">${p.views}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:linear-gradient(135deg,#00c896,#0099ff);padding:28px 32px;">
    <div style="color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Monthly Performance Report</div>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">${data.businessName}</h1>
    <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px;">${monthLabel}</div>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="padding-right:8px;">
        <table width="100%" style="background:#111;border-radius:12px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding:20px;text-align:center;">
          <div style="color:#3b82f6;font-size:36px;font-weight:900;">${data.views.toLocaleString()}</div>
          <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Page Views</div>
        </td></tr></table>
      </td>
      <td width="50%" style="padding-left:8px;">
        <table width="100%" style="background:#111;border-radius:12px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding:20px;text-align:center;">
          <div style="color:#10b981;font-size:36px;font-weight:900;">${data.bookingClicks}</div>
          <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Booking Clicks</div>
        </td></tr></table>
      </td>
    </tr>
    <tr><td colspan="2" style="padding-top:12px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="33%" style="padding-right:6px;"><table width="100%" style="background:#111;border-radius:10px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding:14px;text-align:center;">
          <div style="color:#f59e0b;font-size:24px;font-weight:800;">${data.contactClicks}</div>
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Contact Clicks</div>
        </td></tr></table></td>
        <td width="33%" style="padding:0 3px;"><table width="100%" style="background:#111;border-radius:10px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding:14px;text-align:center;">
          <div style="color:#8b5cf6;font-size:24px;font-weight:800;">${data.bookingCount}</div>
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Bookings Made</div>
        </td></tr></table></td>
        <td width="33%" style="padding-left:6px;"><table width="100%" style="background:#111;border-radius:10px;border:1px solid rgba(255,255,255,0.06);"><tr><td style="padding:14px;text-align:center;">
          <div style="color:#06b6d4;font-size:24px;font-weight:800;">${conversionRate}%</div>
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Click-to-Book Rate</div>
        </td></tr></table></td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  ${topPagesHtml ? `<tr><td style="padding:0 32px 28px;">
    <div style="color:#e2e8f0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Most Visited Pages</div>
    <table width="100%" style="background:#111;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <tr style="background:#0a0a0a;"><td style="padding:10px 16px;color:#64748b;font-size:11px;">Page</td><td style="padding:10px 16px;color:#64748b;font-size:11px;text-align:right;">Views</td></tr>
      ${topPagesHtml}
    </table>
  </td></tr>` : ""}
  <tr><td style="padding:0 32px 28px;">
    <div style="background:#0a1a0f;border:1px solid #10b98133;border-radius:12px;padding:18px;">
      <div style="color:#10b981;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">All-Time Total</div>
      <div style="color:#e2e8f0;font-size:22px;font-weight:800;">${data.totalViews.toLocaleString()} <span style="color:#64748b;font-size:14px;font-weight:400;">total page views</span></div>
    </div>
  </td></tr>
  ${data.previewUrl ? `<tr><td style="padding:0 32px 28px;text-align:center;">
    <a href="${data.previewUrl}" style="display:inline-block;background:linear-gradient(135deg,#00c896,#0099ff);color:#000;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:14px;">View Your Website →</a>
  </td></tr>` : ""}
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <p style="color:#475569;font-size:12px;margin:0;">Monthly report from <strong style="color:#10b981;">WebGecko</strong></p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");
  const send = searchParams.get("send") === "true";

  if (secret !== process.env.PROCESS_SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const month = new Date().toISOString().slice(0, 7);

  const [monthViews, monthBookingClicks, monthContactClicks, totalViews, topPages, allBookings] = await Promise.all([
    getAnalyticsCount(jobId, "page_view", "monthly", month),
    getAnalyticsCount(jobId, "booking_click", "monthly", month),
    getAnalyticsCount(jobId, "contact_click", "monthly", month),
    getAnalyticsCount(jobId, "page_view", "total"),
    getTopPages(jobId),
    getBookingsForJob(jobId),
  ]);

  const bookingCount = allBookings.filter((b: any) => b.status !== "cancelled").length;

  const reportData = {
    businessName: job.userInput?.businessName || jobId,
    month,
    views: monthViews,
    bookingClicks: monthBookingClicks,
    contactClicks: monthContactClicks,
    formSubmits: 0,
    totalViews,
    bookingCount,
    topPages,
    previewUrl: job.previewUrl || "",
  };

  const html = buildReportHtml(reportData);

  if (send) {
    const clientEmail = job.userInput?.email || "";
    if (!clientEmail) return Response.json({ error: "No client email found" }, { status: 400 });
    const monthLabel = new Date(month + "-01").toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    await resend.emails.send({
      from: "WebGecko Reports <hello@webgecko.au>",
      to: clientEmail,
      subject: `Your ${monthLabel} Website Report — ${reportData.businessName}`,
      html,
    });
    return Response.json({ success: true, sentTo: clientEmail });
  }

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
