// app/api/analytics/report/route.ts
// Returns analytics data for a given jobId. Used by client portal and admin dashboard.
import { NextRequest } from "next/server";
import { getClient, getAnalyticsCount, getTopPages, getBookingsForJob } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");

  const isAdmin = secret === process.env.PROCESS_SECRET;
  if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });
  if (!isAdmin && !slug) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!isAdmin && slug) {
    const clientData = await getClient(slug);
    if (!clientData || clientData.job_id !== jobId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);

  const [
    monthViews, monthBookingClicks, monthContactClicks,
    todayViews, todayBookingClicks,
    totalViews, totalBookingClicks,
    topPages, allBookings,
  ] = await Promise.all([
    getAnalyticsCount(jobId, "page_view", "monthly", month),
    getAnalyticsCount(jobId, "booking_click", "monthly", month),
    getAnalyticsCount(jobId, "contact_click", "monthly", month),
    getAnalyticsCount(jobId, "page_view", "daily", today),
    getAnalyticsCount(jobId, "booking_click", "daily", today),
    getAnalyticsCount(jobId, "page_view", "total"),
    getAnalyticsCount(jobId, "booking_click", "total"),
    getTopPages(jobId),
    getBookingsForJob(jobId),
  ]);

  const bookingCount = allBookings.filter((b: any) => b.status !== "cancelled").length;

  return Response.json({
    thisMonth: { views: monthViews, bookingClicks: monthBookingClicks, contactClicks: monthContactClicks },
    today: { views: todayViews, bookingClicks: todayBookingClicks },
    totals: { views: totalViews, bookingClicks: totalBookingClicks },
    topPages,
    bookingCount,
  });
}
