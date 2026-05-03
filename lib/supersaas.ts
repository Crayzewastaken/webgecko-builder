// lib/supersaas.ts
// SuperSaas API helper — master account owns all schedules.
// Each client gets their own sub-user so they can log in and manage their schedule
// without seeing or touching other clients' bookings.

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
  // Sub-user credentials — give these to the client so they can log into SuperSaas
  // and manage their own bookings without seeing the master account
  subUserId?: number;
  subUserEmail?: string;
  subUserPassword?: string;
}

/**
 * Creates a SuperSaas schedule + a sub-user for the client.
 * The sub-user can log into supersaas.com with their own email/password
 * and only sees their own schedule — not the master WebGecko account.
 */
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
    // ── Step 1: Create the schedule ──────────────────────────────────────────
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
        // Email client when a new booking is made
        notification: params.clientEmail,
        // Send confirmation email to the customer who booked
        confirm: true,
        // Send created email to client (schedule owner)
        created_email: params.clientEmail,
      },
    });

    console.log("[SuperSaas] Raw schedule creation response:", JSON.stringify(result).slice(0, 400));
    const schedule = Array.isArray(result) ? result[0] : (result?.schedule || result);
    const id = schedule?.id;
    if (!id) throw new Error("No schedule ID in response: " + JSON.stringify(result).slice(0, 200));
    // IMPORTANT: trust slugName over the returned name — SuperSaas sometimes returns the
    // master template schedule object if the name was already taken. We always use the name
    // we requested (slugName) as the authoritative schedule name for URL building.
    const actualName = slugName;
    console.log(`[SuperSaas] Created schedule "${actualName}" (SS returned name="${schedule?.name}") id=${id} for "${params.businessName}"`);

    // ── Step 2: Create sub-user for the client ───────────────────────────────
    // Generate a secure random password for the sub-user
    const subPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + "!2";
    let subUserId: number | undefined;
    let subUserEmail: string | undefined;
    let subUserPassword: string | undefined;

    try {
      // Try creating sub-user. SuperSaas 400 often means the email already exists as a user.
      // We try 3 strategies:
      //   1. POST with schedules:[id] (numeric ID) and role:"user"
      //   2. POST without schedules field
      //   3. GET /users to find the existing user by email (if email already registered)
      const subPassForEmbed = subPassword; // save for embed URL regardless of which path succeeds

      const tryCreate = async (payload: Record<string, any>) => {
        // Log the exact payload so we can debug 400s
        console.log("[SuperSaas] POST /users payload:", JSON.stringify({ user: payload }).slice(0, 300));
        return ssRequest("/users", "POST", { user: payload });
      };

      let userResult: any;
      const basePayload: Record<string, any> = {
        name: params.businessName,
        email: params.clientEmail,
        password: subPassword,
        password_confirmation: subPassword,
        role: "user",
      };

      try {
        // Strategy 1: with schedules array (numeric IDs)
        userResult = await tryCreate({ ...basePayload, schedules: [id] });
      } catch (e1) {
        const m1 = (e1 as Error).message;
        console.warn("[SuperSaas] Strategy 1 failed:", m1);
        try {
          // Strategy 2: without schedules field
          userResult = await tryCreate(basePayload);
        } catch (e2) {
          const m2 = (e2 as Error).message;
          console.warn("[SuperSaas] Strategy 2 failed:", m2);
          // Strategy 3: email already exists — look up existing user
          if (m2.includes("400")) {
            console.log("[SuperSaas] Trying to find existing user by email...");
            try {
              const usersResp = await ssRequest("/users", "GET");
              const allUsers: any[] = Array.isArray(usersResp) ? usersResp : (usersResp?.users || []);
              const existing = allUsers.find((u: any) => u.email === params.clientEmail);
              if (existing) {
                console.log(`[SuperSaas] Found existing user id=${existing.id} — reusing with new password`);
                // Update their password so we know what it is for the embed URL
                await ssRequest(`/users/${existing.id}`, "PUT", {
                  user: { password: subPassword, password_confirmation: subPassword }
                }).catch(() => {
                  console.warn("[SuperSaas] Could not update existing user password");
                });
                userResult = existing;
              } else {
                throw new Error("Email not found in user list either — " + m2);
              }
            } catch (e3) {
              throw new Error("All 3 strategies failed: " + (e3 as Error).message);
            }
          } else {
            throw e2;
          }
        }
      }

      const user = Array.isArray(userResult) ? userResult[0] : (userResult?.user || userResult);
      subUserId = user?.id;
      subUserEmail = params.clientEmail;
      subUserPassword = subPassForEmbed;
      console.log(`[SuperSaas] Sub-user ready: id=${subUserId} email=${params.clientEmail}`);
    } catch (userErr) {
      // Sub-user creation is non-fatal — schedule still works without it
      // (client just won't have their own login; they use the embed iframe)
      console.warn("[SuperSaas] Sub-user creation failed (non-fatal):", (userErr as Error).message);
    }

    // Base schedule URL (master account owns the schedule)
    const baseUrl = `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(actualName)}`;

    // If we created a sub-user, embed with their credentials so the iframe auto-logs-in
    // as THEM — they see only their schedule, not the master webgecko account view.
    // ?user=email&password=xxx is SuperSaas's SSO/auto-login mechanism for embeds.
    const embedUrl = (subUserEmail && subUserPassword)
      ? `${baseUrl}?user=${encodeURIComponent(subUserEmail)}&password=${encodeURIComponent(subUserPassword)}`
      : baseUrl;

    return {
      id,
      name: actualName,
      embedUrl,
      bookUrl: baseUrl,   // plain URL for direct link (no credentials in address bar)
      subUserId,
      subUserEmail,
      subUserPassword,
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
