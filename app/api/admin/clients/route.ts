// app/api/admin/clients/route.ts
// Returns all clients with their analytics + booking counts for the admin dashboard.
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
  const secret = searchParams.get("secret");

  if (secret !== process.env.PROCESS_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Scan for all client:* keys
  let cursor = 0;
  const clientKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "client:*", count: 100 });
    cursor = Number(nextCursor);
    clientKeys.push(...(keys as string[]));
  } while (cursor !== 0);

  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().split("T")[0];

  const clients = await Promise.all(
    clientKeys.map(async (key) => {
      const clientData = await redis.get<any>(key);
      if (!clientData) return null;

      const slug = key.replace("client:", "");
      const jobId = clientData.jobId || "";

      // Get payment state
      const paymentState = jobId ? await redis.get<any>(`payment:${jobId}`) : null;

      // Get job data for business info
      const job = jobId ? await redis.get<any>(`job:${jobId}`) : null;

      // Get analytics
      let analytics = null;
      if (jobId) {
        const [
          monthViews, monthBookingClicks, monthContactClicks,
          todayViews, todayBookingClicks,
          totalViews, totalBookingClicks, totalFormSubmits,
        ] = await Promise.all([
          getCounter(`analytics:${jobId}:monthly:${month}:page_view`),
          getCounter(`analytics:${jobId}:monthly:${month}:booking_click`),
          getCounter(`analytics:${jobId}:monthly:${month}:contact_click`),
          getCounter(`analytics:${jobId}:daily:${today}:page_view`),
          getCounter(`analytics:${jobId}:daily:${today}:booking_click`),
          getCounter(`analytics:${jobId}:total:page_view`),
          getCounter(`analytics:${jobId}:total:booking_click`),
          getCounter(`analytics:${jobId}:total:form_submit`),
        ]);
        analytics = {
          thisMonth: { views: monthViews, bookingClicks: monthBookingClicks, contactClicks: monthContactClicks },
          today: { views: todayViews, bookingClicks: todayBookingClicks },
          totals: { views: totalViews, bookingClicks: totalBookingClicks, formSubmits: totalFormSubmits },
        };
      }

      // Get booking count
      let bookingCount = 0;
      if (jobId) {
        const index = await redis.get<string[]>(`bookings:index:${jobId}`);
        bookingCount = index?.length || 0;
      }

      return {
        slug,
        jobId,
        businessName: clientData.businessName || job?.userInput?.businessName || slug,
        industry: job?.userInput?.industry || "",
        previewUrl: clientData.previewUrl || job?.previewUrl || "",
        buildStatus: clientData.buildStatus || job?.status || "pending",
        hasBooking: clientData.hasBooking || false,
        builtAt: clientData.builtAt || job?.builtAt || null,
        domain: job?.userInput?.domain || clientData.domain || "",
        liveDomain: job?.liveDomain || clientData.liveDomain || "",
        liveUrl: job?.liveUrl || clientData.liveUrl || "",
        vercelProjectName: job?.vercelProjectName || "",
        paymentState: {
          depositPaid: paymentState?.depositPaid || false,
          finalPaid: paymentState?.finalPaid || false,
          monthlyActive: paymentState?.monthlyActive || false,
        },
        analytics,
        bookingCount,
      };
    })
  );

  // Filter nulls, sort by builtAt desc
  const valid = clients
    .filter(Boolean)
    .sort((a: any, b: any) => (a!.builtAt > b!.builtAt ? -1 : 1));

  return Response.json({ clients: valid });
}
