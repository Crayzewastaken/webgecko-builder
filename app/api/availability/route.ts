import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

interface AvailabilityConfig {
  jobId: string;
  businessName: string;
  clientEmail: string;
  timezone: string;
  days: number[];
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxDaysAhead: number;
  services: { name: string; duration: number }[];
}

interface BookingRecord {
  bookingId: string;
  jobId: string;
  date: string;
  time: string;
  status: string;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const date = url.searchParams.get("date");

    if (!jobId || !date) {
      return Response.json(
        { error: "jobId and date are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: "date must be in YYYY-MM-DD format" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Load availability config
    const config = await redis.get<AvailabilityConfig>(`availability:${jobId}`);
    if (!config) {
      return Response.json(
        { error: "Booking system not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Check date validity
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const [year, month, day] = date.split("-").map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Past date check
    if (requestedDate < today) {
      return Response.json(
        { available: [], date, timezone: config.timezone, slotDuration: config.slotDurationMinutes },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Too far ahead check
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + config.maxDaysAhead);
    if (requestedDate > maxDate) {
      return Response.json(
        { available: [], date, timezone: config.timezone, slotDuration: config.slotDurationMinutes },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Check day of week
    const dayOfWeek = requestedDate.getDay();
    if (!config.days.includes(dayOfWeek)) {
      return Response.json(
        { available: [], date, timezone: config.timezone, slotDuration: config.slotDurationMinutes },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Generate all possible slots
    const allSlots: string[] = [];
    const startMinutes = config.startHour * 60;
    const endMinutes = config.endHour * 60;
    for (let m = startMinutes; m + config.slotDurationMinutes <= endMinutes; m += config.slotDurationMinutes) {
      allSlots.push(minutesToTime(m));
    }

    // Load existing bookings for this date
    const indexKey = `bookings:index:${jobId}`;
    const allBookingIds = (await redis.get<string[]>(indexKey)) ?? [];

    const bookingsForDate: BookingRecord[] = [];
    for (const bid of allBookingIds) {
      const b = await redis.get<BookingRecord>(`booking:${jobId}:${bid}`);
      if (b && b.date === date) {
        bookingsForDate.push(b);
      }
    }

    // Filter out conflicting slots
    const available = allSlots.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + config.slotDurationMinutes;

      for (const existing of bookingsForDate) {
        const bookedStart = timeToMinutes(existing.time);
        const bookedEnd = bookedStart + config.slotDurationMinutes + config.bufferMinutes;
        if (slotStart < bookedEnd && slotEnd > bookedStart) {
          return false;
        }
      }

      // If today, filter out past times (add 30min buffer for same-day bookings)
      if (date === todayStr) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
        if (slotStart < nowMinutes) {
          return false;
        }
      }

      return true;
    });

    return Response.json(
      {
        available,
        date,
        timezone: config.timezone,
        slotDuration: config.slotDurationMinutes,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Availability route error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
