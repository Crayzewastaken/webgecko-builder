// lib/supersaas.ts
// SuperSaas API helper - auto-creates a booking schedule under the master WebGecko account.

const SS_ACCOUNT = process.env.SUPERSAAS_ACCOUNT_NAME!;
const SS_API_KEY  = process.env.SUPERSAAS_API_KEY!;
const SS_BASE     = "https://www.supersaas.com/api";

async function ssRequest(path: string, method = "GET", body?: Record<string, any>) {
  const url = `${SS_BASE}${path}.json?account=${encodeURIComponent(SS_ACCOUNT)}&api_key=${encodeURIComponent(SS_API_KEY)}`;
  const basicAuth = Buffer.from(`${SS_ACCOUNT}:${SS_API_KEY}`).toString("base64");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Basic ${basicAuth}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SuperSaas API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

export interface SuperSaasSchedule {
  id: number;
  name: string;
  embedUrl: string;
  bookUrl: string;
}

export async function createSuperSaasSchedule(params: {
  businessName: string;
  clientEmail: string;
  timezone?: string;
}): Promise<SuperSaasSchedule | null> {
  if (!SS_ACCOUNT || !SS_API_KEY) {
    console.warn("[SuperSaas] API keys not set - skipping schedule creation");
    return null;
  }

  const slugName = params.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

  try {
    const result = await ssRequest("/schedules", "POST", {
      schedule: {
        name: slugName,
        description: `Booking schedule for ${params.businessName}`,
        time_zone: params.timezone || "Brisbane",
        slot_duration: 60,
        max_appointments: 1,
        start_time: "09:00",
        end_time: "17:00",
        durations: [60],
        // SuperSaas uses "notification" as a comma-separated list of emails to notify on new booking
        notification: params.clientEmail,
        // "confirm" sends a confirmation email to the booker
        confirm: true,
        // "created_email" is sent to the schedule owner (client) when a reservation is made
        created_email: params.clientEmail,
      },
    });

    // SuperSaas returns an array: [{ id, name, ... }]
    const schedule = Array.isArray(result) ? result[0] : (result?.schedule || result);
    const id = schedule?.id;
    if (!id) throw new Error("No schedule ID in response: " + JSON.stringify(result).slice(0, 200));
    const actualName = schedule?.name || slugName;

    console.log(`[SuperSaas] Created schedule "${actualName}" id=${id} for "${params.businessName}"`);

    return {
      id,
      name: actualName,
      embedUrl: `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(actualName)}`,
      bookUrl:  `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(actualName)}`,
    };
  } catch (err) {
    console.error("[SuperSaas] Failed to create schedule:", err);
    return null;
  }
}

export function generateBookingEmbed(params: {
  bookingUrl: string;
  businessName: string;
  primaryColor?: string;
}): string {
  const { bookingUrl, businessName, primaryColor = "#10b981" } = params;
  const lines = [
    '<section id="booking" style="padding:80px 24px;background:#0a0f1a;">',
    '  <div style="max-width:900px;margin:0 auto;text-align:center;">',
    '    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin-bottom:8px;">Book an Appointment</h2>',
    `    <p style="color:#94a3b8;margin-bottom:32px;">Schedule your appointment with ${businessName} online.</p>`,
    '    <div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">',
    `      <iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" scrolling="auto" style="display:block;background:#fff;" title="Book an Appointment" loading="lazy"></iframe>`,
    '    </div>',
    `    <p style="color:#475569;font-size:12px;margin-top:16px;">Prefer to call? <a href="tel:" style="color:${primaryColor};">Phone us directly</a></p>`,
    '  </div>',
    '</section>',
  ];
  return lines.join("\n");
}

// ─── Appointment Management ───────────────────────────────────────────────────

export interface SuperSaasAppointment {
  id: number;
  scheduleId: number;
  start: string;        // ISO datetime
  finish: string;       // ISO datetime
  status: string;       // "confirmed" | "pending" | "cancelled"
  fullName: string;
  email: string;
  phone: string;
  description: string;
  createdOn: string;
}

function parseAppointment(a: any): SuperSaasAppointment {
  return {
    id:         a.id,
    scheduleId: a.schedule_id,
    start:      a.start || a.slot_start || "",
    finish:     a.finish || a.slot_end || "",
    status:     a.status || "confirmed",
    fullName:   a.full_name || a.name || "",
    email:      a.email || "",
    phone:      a.mobile || a.phone || "",
    description: a.description || "",
    createdOn:  a.created_on || "",
  };
}

export async function listAppointments(scheduleId: number, params?: {
  start?: string;  // YYYY-MM-DD
  limit?: number;
}): Promise<SuperSaasAppointment[]> {
  if (!SS_ACCOUNT || !SS_API_KEY) return [];
  try {
    let path = `/appointments?schedule_id=${scheduleId}`;
    if (params?.start) path += `&start=${params.start}`;
    if (params?.limit) path += `&limit=${params.limit}`;
    // ssRequest appends .json but appointments endpoint doesn't use path like others
    const url = `${SS_BASE}/appointments.json?account=${encodeURIComponent(SS_ACCOUNT)}&api_key=${encodeURIComponent(SS_API_KEY)}&schedule_id=${scheduleId}${params?.start ? "&start=" + params.start : ""}${params?.limit ? "&limit=" + params.limit : ""}`;
    const basicAuth = Buffer.from(`${SS_ACCOUNT}:${SS_API_KEY}`).toString("base64");
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "Authorization": `Basic ${basicAuth}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SuperSaas ${res.status}: ${text}`);
    const data = JSON.parse(text);
    const appointments = Array.isArray(data) ? data : (data?.appointments || []);
    return appointments.map(parseAppointment);
  } catch (err) {
    console.error("[SuperSaas] listAppointments failed:", err);
    return [];
  }
}

export async function cancelAppointment(appointmentId: number): Promise<boolean> {
  if (!SS_ACCOUNT || !SS_API_KEY) return false;
  try {
    await ssRequest(`/appointments/${appointmentId}`, "DELETE");
    return true;
  } catch (err) {
    console.error("[SuperSaas] cancelAppointment failed:", err);
    return false;
  }
}

export async function rescheduleAppointment(appointmentId: number, params: {
  start: string;   // ISO datetime e.g. "2025-06-15T10:00:00"
  finish: string;
}): Promise<boolean> {
  if (!SS_ACCOUNT || !SS_API_KEY) return false;
  try {
    await ssRequest(`/appointments/${appointmentId}`, "PUT", {
      appointment: { start: params.start, finish: params.finish },
    });
    return true;
  } catch (err) {
    console.error("[SuperSaas] rescheduleAppointment failed:", err);
    return false;
  }
}
