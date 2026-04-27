import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface BookingRecord {
  bookingId: string;
  jobId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  service: string;
  date: string;
  time: string;
  message?: string;
  status: string;
  createdAt: string;
}

interface ClientData {
  jobId: string;
  slug: string;
  hasBooking: boolean;
}

// Verify the client session via cookie (set by /api/client-login)
async function verifyClientSession(request: NextRequest, slug: string): Promise<boolean> {
  const cookie = request.cookies.get(`wg_session_${slug}`);
  if (!cookie) return false;

  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData) return false;

  return cookie.value === slug;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");

  if (!jobId || !slug) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const authorized = await verifyClientSession(request, slug);
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify this jobId belongs to this slug
  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData || clientData.jobId !== jobId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const indexKey = `bookings:index:${jobId}`;
  const allBookingIds = (await redis.get<string[]>(indexKey)) ?? [];

  const bookings: BookingRecord[] = [];
  for (const bid of allBookingIds) {
    const b = await redis.get<BookingRecord>(`booking:${jobId}:${bid}`);
    if (b) bookings.push(b);
  }

  // Sort newest first
  bookings.sort((a, b) => (a.date < b.date ? 1 : -1));

  return Response.json({ bookings });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");
  const bookingId = url.searchParams.get("bookingId");

  if (!jobId || !slug || !bookingId) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const authorized = await verifyClientSession(request, slug);
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData || clientData.jobId !== jobId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mark as cancelled (don't delete — keep the record)
  const bookingKey = `booking:${jobId}:${bookingId}`;
  const existing = await redis.get<BookingRecord>(bookingKey);
  if (!existing) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  await redis.set(bookingKey, { ...existing, status: "cancelled" }, { ex: 365 * 24 * 3600 });

  return Response.json({ success: true });
}