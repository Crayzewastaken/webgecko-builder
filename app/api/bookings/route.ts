import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

interface BookingRecord {
  bookingId: string;
  jobId: string;
  businessName: string;
  clientEmail: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  service: string;
  date: string;
  time: string;
  timezone: string;
  message: string;
  status: string;
  createdAt: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const secret = url.searchParams.get("secret");

    if (!jobId || !secret) {
      return Response.json(
        { error: "jobId and secret are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (secret !== process.env.PROCESS_SECRET) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const indexKey = `bookings:index:${jobId}`;
    const allBookingIds = (await redis.get<string[]>(indexKey)) ?? [];

    const bookings: BookingRecord[] = [];
    for (const bid of allBookingIds) {
      try {
        const b = await redis.get<BookingRecord>(`booking:${jobId}:${bid}`);
        if (b) {
          bookings.push(b);
        }
      } catch (err) {
        console.error(`Failed to fetch booking ${bid}:`, err);
      }
    }

    // Sort by date descending, then time descending
    bookings.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });

    return Response.json(
      { bookings, total: bookings.length },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Bookings GET error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const secret = url.searchParams.get("secret");
    const bookingId = url.searchParams.get("bookingId");

    if (!jobId || !secret || !bookingId) {
      return Response.json(
        { error: "jobId, secret, and bookingId are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (secret !== process.env.PROCESS_SECRET) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Delete the booking record
    await redis.del(`booking:${jobId}:${bookingId}`);

    // Remove from index
    const indexKey = `bookings:index:${jobId}`;
    const allBookingIds = (await redis.get<string[]>(indexKey)) ?? [];
    const updatedIndex = allBookingIds.filter((id) => id !== bookingId);
    await redis.set(indexKey, updatedIndex);

    return Response.json(
      { success: true, deleted: bookingId },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Bookings DELETE error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
