import { Resend } from "resend";
import { getAvailability, getBookingsForJob, saveBooking } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY!);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function buildVisitorEmail(b: any): string {
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
          <p style="color:#94a3b8;margin:0 0 8px;">Hi ${b.visitorName},</p>
          <p style="color:#e2e8f0;margin:0 0 24px;">Your booking with <strong style="color:#10b981;">${b.businessName}</strong> has been confirmed.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Service</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${b.service}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${b.date} at ${b.time} (${b.timezone})</p>
            </td></tr>
            ${b.message ? `<tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Message</span>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">${b.message}</p>
            </td></tr>` : ""}
          </table>
          <p style="color:#64748b;font-size:13px;margin:0;">If you need to make changes, please contact us directly.</p>
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

function buildClientNotificationEmail(b: any): string {
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
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${b.visitorName}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email</span>
              <p style="color:#10b981;margin:4px 0 0;font-size:15px;">${b.visitorEmail}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Phone</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:15px;">${b.visitorPhone}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Service</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${b.service}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;${b.message ? "border-bottom:1px solid rgba(255,255,255,0.06);" : ""}">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</span>
              <p style="color:#e2e8f0;margin:4px 0 0;font-size:16px;font-weight:600;">${b.date} at ${b.time} (${b.timezone})</p>
            </td></tr>
            ${b.message ? `<tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message</span>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">${b.message}</p>
            </td></tr>` : ""}
          </table>
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

    const config = await getAvailability(jobId);
    if (!config) {
      return Response.json({ error: "Booking system not found for this site" }, { status: 404, headers: CORS_HEADERS });
    }

    // Check day of week
    const [year, month, day] = date.split("-").map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const dayOfWeek = requestedDate.getDay();
    if (!config.days.includes(dayOfWeek)) {
      return Response.json({ error: "This day is not available for bookings" }, { status: 409, headers: CORS_HEADERS });
    }

    // Conflict detection
    const allBookings = await getBookingsForJob(jobId);
    const bookingsForDate = allBookings.filter((b: any) => {
      if (!b.slot_start || b.status === "cancelled") return false;
      return new Date(b.slot_start).toISOString().startsWith(date);
    });

    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + config.slotDurationMinutes;

    for (const existing of bookingsForDate) {
      const bookedTime = new Date(existing.slot_start).toTimeString().slice(0, 5);
      const bookedStart = timeToMinutes(bookedTime);
      const bookedEnd = bookedStart + config.slotDurationMinutes + config.bufferMinutes;
      if (slotStart < bookedEnd && slotEnd > bookedStart) {
        return Response.json({ error: "This time slot is no longer available" }, { status: 409, headers: CORS_HEADERS });
      }
    }

    // Build slot timestamps
    const slotStartISO = `${date}T${time}:00`;
    const endHour = Math.floor((slotStart + config.slotDurationMinutes) / 60);
    const endMin = (slotStart + config.slotDurationMinutes) % 60;
    const slotEndISO = `${date}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

    // Save to Supabase
    const saved = await saveBooking({
      jobId,
      customerName: visitorName,
      customerEmail: visitorEmail,
      customerPhone: visitorPhone,
      service,
      slotStart: slotStartISO,
      slotEnd: slotEndISO,
      notes: message,
    });

    const emailData = { visitorName, visitorEmail, visitorPhone, service, date, time, timezone: config.timezone, message, businessName: config.businessName };

    // Send visitor confirmation
    try {
      await resend.emails.send({
        from: "WebGecko Bookings <bookings@webgecko.au>",
        to: visitorEmail,
        subject: `Booking Confirmed — ${config.businessName}`,
        html: buildVisitorEmail(emailData),
      });
    } catch (e) { console.error("Visitor email failed:", e); }

    // Send client notification
    try {
      await resend.emails.send({
        from: "WebGecko Bookings <bookings@webgecko.au>",
        to: config.clientEmail,
        subject: `New Booking — ${visitorName} on ${date}`,
        html: buildClientNotificationEmail(emailData),
      });
    } catch (e) { console.error("Client notification email failed:", e); }

    return Response.json(
      { success: true, bookingId: saved.id, message: "Booking confirmed", booking: { date, time, service, timezone: config.timezone } },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Book route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
