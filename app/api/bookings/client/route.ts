import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

interface BookingRecord {
  bookingId: string; jobId: string; businessName: string; clientEmail: string;
  visitorName: string; visitorEmail: string; visitorPhone: string;
  service: string; date: string; time: string; timezone: string;
  message?: string; status: string; cancelReason?: string;
  confirmedAt?: string; declinedAt?: string; rescheduledAt?: string; createdAt: string;
}
interface ClientData { jobId: string; slug: string; hasBooking: boolean; }

async function verifyClientSession(request: NextRequest, slug: string): Promise<boolean> {
  // Primary: wg_client_slug cookie set by the login route
  const primaryCookie = request.cookies.get("wg_client_slug");
  if (primaryCookie && primaryCookie.value === slug) return true;
  // Legacy fallback: per-slug session cookie (older login flow)
  const legacyCookie = request.cookies.get(`wg_session_${slug}`);
  if (legacyCookie && legacyCookie.value === slug) return true;
  return false;
}

async function sendStatusEmail(booking: BookingRecord, action: string, reason?: string) {
  const colors: Record<string, string> = { confirmed: "#10b981", declined: "#ef4444", rescheduled: "#f59e0b", cancelled: "#6b7280" };
  const color = colors[action] || "#10b981";
  const reasonRow = reason
    ? "<tr><td style=\"padding:14px 20px;\"><span style=\"color:#64748b;font-size:11px;text-transform:uppercase;\">Note from " + booking.businessName + "</span><p style=\"color:#94a3b8;margin:4px 0 0;\">" + reason + "</p></td></tr>"
    : "";
  const html = "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;\">"
    + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0a0f1a;padding:40px 20px;\"><tr><td align=\"center\">"
    + "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);\">"
    + "<tr><td style=\"background:" + color + ";padding:24px 32px;\"><h1 style=\"margin:0;color:#fff;font-size:22px;\">Booking " + action + "</h1></td></tr>"
    + "<tr><td style=\"padding:32px;\">"
    + "<p style=\"color:#94a3b8;margin:0 0 8px;\">Hi " + booking.visitorName + ",</p>"
    + "<p style=\"color:#e2e8f0;margin:0 0 24px;\">Your booking with <strong style=\"color:" + color + ";\">" + booking.businessName + "</strong> has been <strong>" + action + "</strong>.</p>"
    + "<table width=\"100%\" style=\"background:#0a0f1a;border-radius:8px;margin-bottom:24px;\">"
    + "<tr><td style=\"padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);\"><span style=\"color:#64748b;font-size:11px;\">Service</span><p style=\"color:#e2e8f0;margin:4px 0 0;font-weight:600;\">" + booking.service + "</p></td></tr>"
    + "<tr><td style=\"padding:14px 20px;" + (reason ? "border-bottom:1px solid rgba(255,255,255,0.06);" : "") + "\"><span style=\"color:#64748b;font-size:11px;\">Date &amp; Time</span><p style=\"color:#e2e8f0;margin:4px 0 0;font-weight:600;\">" + booking.date + " at " + booking.time + " (" + booking.timezone + ")</p></td></tr>"
    + reasonRow
    + "</table>"
    + "<p style=\"color:#64748b;font-size:13px;margin:0;\">Questions? Contact us directly.</p>"
    + "</td></tr><tr><td style=\"padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);\"><p style=\"color:#475569;font-size:12px;margin:0;\">Sent by WebGecko Booking System</p></td></tr>"
    + "</table></td></tr></table></body></html>";
  const subjects: Record<string, string> = {
    confirmed: "Booking Confirmed — " + booking.businessName,
    declined: "Booking Update — " + booking.businessName,
    rescheduled: "Booking Rescheduled — " + booking.businessName,
    cancelled: "Booking Cancelled — " + booking.businessName,
  };
  await resend.emails.send({
    from: "WebGecko Bookings <bookings@webgecko.au>",
    to: booking.visitorEmail,
    subject: subjects[action] || "Booking Update — " + booking.businessName,
    html,
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");
  if (!jobId || !slug) return Response.json({ error: "Missing params" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData || clientData.jobId !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const allBookingIds = (await redis.get<string[]>(`bookings:index:${jobId}`)) ?? [];
  const bookings: BookingRecord[] = [];
  for (const bid of allBookingIds) {
    const b = await redis.get<BookingRecord>(`booking:${jobId}:${bid}`);
    if (b) bookings.push(b);
  }
  bookings.sort((a, b) => (a.date < b.date ? 1 : -1));
  return Response.json({ bookings });
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const { jobId, bookingId, action, reason, newDate, newTime } = body;
  if (!jobId || !bookingId || !action) return Response.json({ error: "Missing fields" }, { status: 400 });
  if (clientData.jobId !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const bookingKey = `booking:${jobId}:${bookingId}`;
  const existing = await redis.get<BookingRecord>(bookingKey);
  if (!existing) return Response.json({ error: "Booking not found" }, { status: 404 });
  const now = new Date().toISOString();
  let updated: BookingRecord;
  switch (action) {
    case "confirm": updated = { ...existing, status: "confirmed", confirmedAt: now }; break;
    case "decline": updated = { ...existing, status: "declined", declinedAt: now, cancelReason: reason || "" }; break;
    case "reschedule":
      if (!newDate || !newTime) return Response.json({ error: "newDate and newTime required" }, { status: 400 });
      updated = { ...existing, status: "rescheduled", date: newDate, time: newTime, rescheduledAt: now }; break;
    case "cancel": updated = { ...existing, status: "cancelled", cancelReason: reason || "", declinedAt: now }; break;
    default: return Response.json({ error: "Unknown action" }, { status: 400 });
  }
  await redis.set(bookingKey, updated, { ex: 365 * 24 * 3600 });
  try {
    const emailAction = action === "decline" ? "declined" : action === "reschedule" ? "rescheduled" : action === "cancel" ? "cancelled" : "confirmed";
    await sendStatusEmail(updated, emailAction, reason);
  } catch (e) { console.error("Status email failed:", e); }
  return Response.json({ success: true, booking: updated });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const { jobId, visitorName, visitorEmail, visitorPhone, service, date, time, message } = body;
  if (!jobId || !visitorName || !visitorEmail || !service || !date || !time)
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  if (clientData.jobId !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const job = await redis.get<any>(`job:${jobId}`);
  const businessName = job?.userInput?.businessName || "Your Business";
  const bookingId = crypto.randomUUID();
  const booking: BookingRecord = {
    bookingId, jobId, businessName, clientEmail: slug,
    visitorName, visitorEmail, visitorPhone: visitorPhone || "",
    service, date, time, timezone: "Australia/Brisbane",
    message: message || "", status: "confirmed",
    confirmedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  };
  await redis.set(`booking:${jobId}:${bookingId}`, booking, { ex: 365 * 24 * 3600 });
  const existing = (await redis.get<string[]>(`bookings:index:${jobId}`)) ?? [];
  await redis.set(`bookings:index:${jobId}`, [...existing, bookingId]);
  try { await sendStatusEmail(booking, "confirmed"); } catch (e) { console.error("Manual booking email failed:", e); }
  return Response.json({ success: true, booking });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");
  const bookingId = url.searchParams.get("bookingId");
  if (!jobId || !slug || !bookingId) return Response.json({ error: "Missing params" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await redis.get<ClientData>(`client:${slug}`);
  if (!clientData || clientData.jobId !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const bookingKey = `booking:${jobId}:${bookingId}`;
  const existing = await redis.get<BookingRecord>(bookingKey);
  if (!existing) return Response.json({ error: "Booking not found" }, { status: 404 });
  await redis.set(bookingKey, { ...existing, status: "cancelled" }, { ex: 365 * 24 * 3600 });
  return Response.json({ success: true });
}
