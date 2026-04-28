// app/api/analytics/report/route.ts
// Returns analytics data for a given jobId. Used by client portal and admin dashboard.
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function getCounter(key: string): Promise<number> {
  const val = await redis.get<number>(key);
  return typeof val === "number" ? val : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");

  // Allow access via PROCESS_SECRET (admin) or client session
  const isAdmin = secret === process.env.PROCESS_SECRET;
  if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });
  if (!isAdmin && !slug) return Response.json({ error: "Forbidden" }, { status: 403 });

  // If client request, verify slug matches jobId
  if (!isAdmin && slug) {
    const clientData = await redis.get<any>(`client:${slug}`);
    if (!clientData || clientData.jobId !== jobId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);

  // Build last 30 days array
  const daily: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    const views = await getCounter(`analytics:${jobId}:daily:${d}:page_view`);
    daily[d] = views;
  }

  const [
    totalViews, totalBookingClicks, totalContactClicks, totalFormSubmits,
    monthViews, monthBookingClicks, monthContactClicks,
    todayViews, todayBookingClicks,
  ] = await Promise.all([
    getCounter(`analytics:${jobId}:total:page_view`),
    getCounter(`analytics:${jobId}:total:booking_click`),
    getCounter(`analytics:${jobId}:total:contact_click`),
    getCounter(`analytics:${jobId}:total:form_submit`),
    getCounter(`analytics:${jobId}:monthly:${month}:page_view`),
    getCounter(`analytics:${jobId}:monthly:${month}:booking_click`),
    getCounter(`analytics:${jobId}:monthly:${month}:contact_click`),
    getCounter(`analytics:${jobId}:daily:${today}:page_view`),
    getCounter(`analytics:${jobId}:daily:${today}:booking_click`),
  ]);

  // Top pages (sorted set)
  const topPages: { page: string; views: number }[] = [];
  try {
    const raw = await redis.zrange(`analytics:${jobId}:pages`, 0, 9, { rev: true, withScores: true });
    // raw is alternating [member, score, member, score, ...]
    for (let i = 0; i < raw.length; i += 2) {
      topPages.push({ page: String(raw[i]), views: Number(raw[i + 1]) });
    }
  } catch {}

  return Response.json({
    jobId,
    daily,
    totals: { views: totalViews, bookingClicks: totalBookingClicks, contactClicks: totalContactClicks, formSubmits: totalFormSubmits },
    thisMonth: { views: monthViews, bookingClicks: monthBookingClicks, contactClicks: monthContactClicks },
    today: { views: todayViews, bookingClicks: todayBookingClicks },
    topPages,
    generatedAt: new Date().toISOString(),
  });
}
