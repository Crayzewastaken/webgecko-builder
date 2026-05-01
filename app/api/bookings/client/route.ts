import { Resend } from "resend";
import { NextRequest } from "next/server";
import { getClient, getBookingsForJob, saveBooking, cancelBooking } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY!);

async function verifyClientSession(request: NextRequest, slug: string): Promise<boolean> {
  const primaryCookie = request.cookies.get("wg_client_slug");
  if (primaryCookie && primaryCookie.value === slug) return true;
  const legacyCookie = request.cookies.get(`wg_session_${slug}`);
  if (legacyCookie && legacyCookie.value === slug) return true;
  return false;
}

async function sendStatusEmail(b: any, action: string, reason?: string) {
  const colors: Record<string, string> = { confirmed: "#10b981", declined: "#ef4444", rescheduled: "#f59e0b", cancelled: "#6b7280" };
  const color = colors[action] || "#10b981";
  const date = new Date(b.slot_start).toISOString().split("T")[0];
  const time = new Date(b.slot_start).toTimeString().slice(0, 5);
  const reasonRow = reason
    ? `<tr><td style="padding:14px 20px;"><span style="color:#64748b;font-size:11px;text-transform:uppercase;">Note</span><p style="color:#94a3b8;margin:4px 0 0;">${reason}</p></td></tr>`
    : "";
  await resend.emails.send({
    from: "WebGecko Bookings <bookings@webgecko.au>",
    to: b.customer_email,
    subject: `Booking ${action} — ${b.business_name || ""}`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <tr><td style="background:${color};padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:22px;">Booking ${action}</h1></td></tr>
  <tr><td style="padding:32px;">
    <p style="color:#94a3b8;margin:0 0 8px;">Hi ${b.customer_name},</p>
    <table width="100%" style="background:#0a0f1a;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#64748b;font-size:11px;">Service</span><p style="color:#e2e8f0;margin:4px 0 0;font-weight:600;">${b.service}</p></td></tr>
      <tr><td style="padding:14px 20px;${reason ? "border-bottom:1px solid rgba(255,255,255,0.06);" : ""}"><span style="color:#64748b;font-size:11px;">Date &amp; Time</span><p style="color:#e2e8f0;margin:4px 0 0;font-weight:600;">${date} at ${time}</p></td></tr>
      ${reasonRow}
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);"><p style="color:#475569;font-size:12px;margin:0;">Sent by WebGecko Booking System</p></td></tr>
</table></td></tr></table>
</body></html>`,
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");
  if (!jobId || !slug) return Response.json({ error: "Missing params" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await getClient(slug);
  if (!clientData || clientData.job_id !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rows = await getBookingsForJob(jobId);
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
  })).sort((a: any, b: any) => b.date.localeCompare(a.date));

  return Response.json({ bookings });
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await getClient(slug);
  if (!clientData) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { jobId, bookingId, action, reason, newDate, newTime } = body;
  if (!jobId || !bookingId || !action) return Response.json({ error: "Missing fields" }, { status: 400 });
  if (clientData.job_id !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!existing) return Response.json({ error: "Booking not found" }, { status: 404 });

  let updateData: any = {};
  switch (action) {
    case "confirm": updateData = { status: "confirmed" }; break;
    case "decline": updateData = { status: "declined", notes: reason || "" }; break;
    case "reschedule":
      if (!newDate || !newTime) return Response.json({ error: "newDate and newTime required" }, { status: 400 });
      updateData = { status: "rescheduled", slot_start: `${newDate}T${newTime}:00` }; break;
    case "cancel": updateData = { status: "cancelled", notes: reason || "" }; break;
    default: return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: updated } = await supabase.from("bookings").update(updateData).eq("id", bookingId).select().single();
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
  const clientData = await getClient(slug);
  if (!clientData) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { jobId, visitorName, visitorEmail, visitorPhone, service, date, time, message } = body;
  if (!jobId || !visitorName || !visitorEmail || !service || !date || !time)
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  if (clientData.job_id !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const slotStart = `${date}T${time}:00`;
  const saved = await saveBooking({
    jobId, customerName: visitorName, customerEmail: visitorEmail,
    customerPhone: visitorPhone || "", service,
    slotStart, slotEnd: slotStart, notes: message || "",
  });

  return Response.json({ success: true, booking: saved });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const slug = url.searchParams.get("slug");
  const bookingId = url.searchParams.get("bookingId");
  if (!jobId || !slug || !bookingId) return Response.json({ error: "Missing params" }, { status: 400 });
  const authorized = await verifyClientSession(request, slug);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clientData = await getClient(slug);
  if (!clientData || clientData.job_id !== jobId) return Response.json({ error: "Forbidden" }, { status: 403 });

  await cancelBooking(bookingId);
  return Response.json({ success: true });
}
