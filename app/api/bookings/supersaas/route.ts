import { NextRequest } from "next/server";
import { getClient, getJob } from "@/lib/db";
import { listAppointments, cancelAppointment, rescheduleAppointment } from "@/lib/supersaas";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

async function verifyClientSession(request: NextRequest, slug: string): Promise<boolean> {
  const primary = request.cookies.get("wg_client_slug");
  if (primary?.value === slug) return true;
  const legacy = request.cookies.get(`wg_session_${slug}`);
  if (legacy?.value === slug) return true;
  return false;
}

// GET /api/bookings/supersaas?slug=xxx — list all appointments
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });
  if (!await verifyClientSession(request, slug)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getClient(slug);
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const job = await getJob(client.job_id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const scheduleId = job.supersaasId;
  if (!scheduleId) return Response.json({ appointments: [], source: "supersaas", scheduleId: null });

  // Fetch from 30 days ago to pull recent + upcoming
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const appointments = await listAppointments(Number(scheduleId), { start, limit: 200 });

  return Response.json({ appointments, source: "supersaas", scheduleId });
}

// POST /api/bookings/supersaas — cancel or reschedule
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });
  if (!await verifyClientSession(request, slug)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = await getClient(slug);
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const body = await request.json();
  const { appointmentId, action, start, finish, reason } = body;
  if (!appointmentId || !action) return Response.json({ error: "Missing appointmentId or action" }, { status: 400 });

  if (action === "cancel") {
    const ok = await cancelAppointment(Number(appointmentId));
    if (!ok) return Response.json({ error: "Cancel failed" }, { status: 500 });

    // Email the customer if email provided
    if (body.customerEmail && body.customerName) {
      try {
        await resend.emails.send({
          from: "WebGecko Bookings <bookings@webgecko.au>",
          to: body.customerEmail,
          subject: "Your booking has been cancelled — " + (client.business_name || ""),
          html: "<p>Hi " + body.customerName + ",</p><p>Your booking on <strong>" + (body.start ? new Date(body.start).toLocaleDateString("en-AU", { weekday:"long", year:"numeric", month:"long", day:"numeric" }) : "the scheduled date") + "</strong> with " + (client.business_name || "") + " has been cancelled." + (reason ? " Reason: " + reason : "") + "</p><p>Please contact us to rebook.</p>",
        });
      } catch (e) { console.error("[SuperSaas] Cancel email failed:", e); }
    }

    return Response.json({ success: true, action: "cancelled" });
  }

  if (action === "reschedule") {
    if (!start || !finish) return Response.json({ error: "Missing start/finish for reschedule" }, { status: 400 });
    const ok = await rescheduleAppointment(Number(appointmentId), { start, finish });
    if (!ok) return Response.json({ error: "Reschedule failed" }, { status: 500 });

    if (body.customerEmail && body.customerName) {
      try {
        await resend.emails.send({
          from: "WebGecko Bookings <bookings@webgecko.au>",
          to: body.customerEmail,
          subject: "Your booking has been rescheduled — " + (client.business_name || ""),
          html: "<p>Hi " + body.customerName + ",</p><p>Your booking with <strong>" + (client.business_name || "") + "</strong> has been rescheduled to <strong>" + new Date(start).toLocaleDateString("en-AU", { weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" }) + "</strong>.</p><p>See you then!</p>",
        });
      } catch (e) { console.error("[SuperSaas] Reschedule email failed:", e); }
    }

    return Response.json({ success: true, action: "rescheduled", start, finish });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
