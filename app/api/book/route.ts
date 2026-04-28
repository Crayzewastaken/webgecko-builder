import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  status: "confirmed";
  createdAt: string;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function buildVisitorEmail(booking: BookingRecord): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Booking Confirmed</title></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:#10b981;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;">Booking Confirmed ✓</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#94a3b8;margin:0 0 8px;">Hi ${booking.visitorName},</p>
          <p style="color:#e2e8f0;margin:0 0 24px;">Your booking with <strong style="color:#10b981;">${booking.businessName}</strong> has been confirmed.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Service</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.service}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.date}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Time</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.time} (${booking.timezone})</p>
            </td></tr>
            ${booking.message ? `<tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Message</span>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">${booking.message}</p>
            </td></tr>` : ""}
          </table>
          <p style="color:#e2e8f0;margin:0 0 8px;">We look forward to seeing you!</p>
          <p style="color:#64748b;font-size:13px;margin:0;">If you need to make changes, please contact us directly.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#475569;font-size:12px;margin:0;">This confirmation was sent automatically. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildClientNotificationEmail(booking: BookingRecord): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Booking</title></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:#10b981;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;">New Booking 📅</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#94a3b8;margin:0 0 24px;">You have a new booking on your website.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer Name</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.visitorName}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email</span>
              <p style="color:#10b981;margin:4px 0 0;font-size:15px;">${booking.visitorEmail}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Phone</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:15px;">${booking.visitorPhone}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Service Requested</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.service}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.date}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:${booking.message ? "1px solid rgba(255,255,255,0.06)" : "none"};">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Time</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${booking.time} (${booking.timezone})</p>
            </td></tr>
            ${booking.message ? `<tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message from Customer</span>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">${booking.message}</p>
            </td></tr>` : ""}
          </table>
          <p style="color:#64748b;font-size:13px;margin:0;">Booking ID: <code style="color:#475569;">${booking.bookingId}</code></p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#475569;font-size:12px;margin:0;">Sent by WebGecko Booking System</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { jobId, visitorName, visitorEmail, visitorPhone, service, date, time, message = "" } = body;

    const requiredFields: Record<string, string> = { jobId, visitorName, visitorEmail, visitorPhone, service, date, time };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || String(value).trim() === "") {
        return Response.json({ error: `${field} is required` }, { status: 400, headers: CORS_HEADERS });
      }
    }

    // Load availability config
    const config = await redis.get<AvailabilityConfig>(`availability:${jobId}`);
    if (!config) {
      return Response.json({ error: "Booking system not found for this site" }, { status: 404, headers: CORS_HEADERS });
    }

    // Check day of week is available
    const [year, month, day] = date.split("-").map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const dayOfWeek = requestedDate.getDay();
    if (!config.days.includes(dayOfWeek)) {
      return Response.json({ error: "This day is not available for bookings" }, { status: 409, headers: CORS_HEADERS });
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

    // Conflict detection
    const slotStart = timeToMinutes(time);
    const serviceDuration = config.slotDurationMinutes;
    const slotEnd = slotStart + serviceDuration;

    for (const existing of bookingsForDate) {
      const bookedStart = timeToMinutes(existing.time);
      const bookedEnd = bookedStart + serviceDuration + config.bufferMinutes;
      if (slotStart < bookedEnd && slotEnd > bookedStart) {
        return Response.json({ error: "This time slot is no longer available" }, { status: 409, headers: CORS_HEADERS });
      }
    }

    // Create booking
    const bookingId = crypto.randomUUID();
    const booking: BookingRecord = {
      bookingId,
      jobId,
      businessName: config.businessName,
      clientEmail: config.clientEmail,
      visitorName,
      visitorEmail,
      visitorPhone,
      service,
      date,
      time,
      timezone: config.timezone,
      message,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };

    const ttl = 60 * 60 * 24 * 365; // 1 year
    await redis.set(`booking:${jobId}:${bookingId}`, booking, { ex: ttl });

    // Update index
    const updatedIndex = [...allBookingIds, bookingId];
    await redis.set(indexKey, updatedIndex);

    // Send visitor confirmation email
    try {
      await resend.emails.send({
        from: "WebGecko Bookings <bookings@webgecko.au>",
        to: visitorEmail,
        subject: `Booking Confirmed — ${config.businessName}`,
        html: buildVisitorEmail(booking),
      });
    } catch (emailErr) {
      console.error("Failed to send visitor confirmation email:", emailErr);
    }

    // Send client notification email
    try {
      await resend.emails.send({
        from: "WebGecko Bookings <bookings@webgecko.au>",
        to: config.clientEmail,
        subject: `New Booking — ${visitorName} on ${date}`,
        html: buildClientNotificationEmail(booking),
      });
    } catch (emailErr) {
      console.error("Failed to send client notification email:", emailErr);
    }

    return Response.json(
      {
        success: true,
        bookingId,
        message: "Booking confirmed",
        booking: {
          date: booking.date,
          time: booking.time,
          service: booking.service,
          timezone: booking.timezone,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Book route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
