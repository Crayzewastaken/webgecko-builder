// app/api/analytics/report/route.ts
// Returns analytics data for a given jobId. Used by client portal and admin dashboard.
import { NextRequest } from "next/server";
import { getClient, getAnalyticsSummary, getTopPages, getBookingsForJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  const isAdmin = isAdminAuthedLegacy(req);
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

  // Single RPC call replaces 7 individual COUNT queries
  const [summary, topPages, allBookings] = await Promise.all([
    getAnalyticsSummary(jobId, today, month),
    getTopPages(jobId),
    getBookingsForJob(jobId),
  ]);

  const bookingCount = allBookings.filter((b: any) => b.status !== "cancelled").length;

  return Response.json({
    thisMonth: {
      views:         summary.month_views,
      bookingClicks: summary.month_booking_clicks,
      contactClicks: summary.month_contact_clicks,
    },
    today: {
      views:         summary.today_views,
      bookingClicks: summary.today_booking_clicks,
    },
    totals: {
      views:         summary.total_views,
      bookingClicks: summary.total_booking_clicks,
    },
    topPages,
    bookingCount,
  });
}
