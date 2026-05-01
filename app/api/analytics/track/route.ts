// app/api/analytics/track/route.ts
import { NextRequest } from "next/server";
import { trackAnalyticsEvent } from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, event, page } = await req.json();
    if (!jobId || !event) return Response.json({ ok: false }, { status: 400, headers: CORS });

    const validEvents = ["page_view", "booking_click", "contact_click", "form_submit"];
    if (!validEvents.includes(event)) return Response.json({ ok: false }, { status: 400, headers: CORS });

    await trackAnalyticsEvent(jobId, event, page);

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    console.error("Analytics track error:", e);
    return Response.json({ ok: false }, { status: 500, headers: CORS });
  }
}
