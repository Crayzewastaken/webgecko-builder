import { getBookingsForJob, cancelBooking } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const secret = url.searchParams.get("secret");

    if (!jobId || !secret) {
      return Response.json({ error: "jobId and secret are required" }, { status: 400, headers: CORS_HEADERS });
    }

    if (secret !== process.env.PROCESS_SECRET) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS });
    }

    const rows = await getBookingsForJob(jobId);

    // Shape into a friendly format
    const bookings = rows.map((b: any) => ({
      bookingId: b.id,
      jobId: b.job_id,
      visitorName: b.customer_name,
      visitorEmail: b.customer_email,
      visitorPhone: b.customer_phone,
      service: b.service,
      date: new Date(b.slot_start).toISOString().split("T")[0],
      time: new Date(b.slot_start).toTimeString().slice(0, 5),
      status: b.status,
      notes: b.notes,
      createdAt: b.created_at,
    })).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

    return Response.json({ bookings, total: bookings.length }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error("Bookings GET error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const secret = url.searchParams.get("secret");
    const bookingId = url.searchParams.get("bookingId");

    if (!jobId || !secret || !bookingId) {
      return Response.json({ error: "jobId, secret, and bookingId are required" }, { status: 400, headers: CORS_HEADERS });
    }

    if (secret !== process.env.PROCESS_SECRET) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS });
    }

    await cancelBooking(bookingId);

    return Response.json({ success: true, deleted: bookingId }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error("Bookings DELETE error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
