// lib/supersaas.ts
// SuperSaas API helper — master account owns all schedules.
// Each client gets their own sub-user so they can log in and manage their schedule
// without seeing or touching other clients' bookings.

const SS_ACCOUNT = process.env.SUPERSAAS_ACCOUNT_NAME!;
const SS_API_KEY  = process.env.SUPERSAAS_API_KEY!;
const SS_BASE     = "https://www.supersaas.com/api";

async function ssRequest(path: string, method = "GET", body?: Record<string, unknown>) {
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
  console.log(`[SuperSaas] ${method} ${path} → HTTP ${res.status} | body: ${text.slice(0, 200)}`);
  if (!res.ok) throw new Error(`SuperSaas API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

export interface SuperSaasSchedule {
  id: number;
  name: string;
  embedUrl: string;
  bookUrl: string;
  // Sub-user identifiers — password is never stored in this struct or in job records.
  subUserId?: number;
  subUserEmail?: string;
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
  bookingServices?: string; // comma-separated list of services for the schedule
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

    // Skip sub-user creation if the client email is the master account owner —
    // SuperSaas won't let you register the account owner as a sub-user.
    const masterAccountEmail = process.env.SUPERSAAS_OWNER_EMAIL || "";
    const isMasterEmail = masterAccountEmail && params.clientEmail.toLowerCase() === masterAccountEmail.toLowerCase();
    if (isMasterEmail) {
      console.log("[SuperSaas] Client email is master account owner — skipping sub-user creation");
    }
    const skipSubUser = !!isMasterEmail;

    if (!skipSubUser) try {
      // Try creating sub-user. SuperSaas 400 often means the email already exists as a user.
      // We try 3 strategies:
      //   1. POST with schedules:[id] (numeric ID) and role:"user"
      //   2. POST without schedules field
      //   3. GET /users to find the existing user by email (if email already registered)
      const tryCreate = async (payload: Record<string, unknown>) => {
        // Log the exact payload so we can debug 400s
        console.log("[SuperSaas] POST /users payload:", JSON.stringify({ user: payload }).slice(0, 300));
        return ssRequest("/users", "POST", { user: payload });
      };

      let userResult: Record<string, unknown> | Record<string, unknown>[];
      // SuperSaas API field notes (from docs):
      //   name     = login name (must be email address if account uses email login)
      //   email    = separate email field (optional if name is already the email)
      //   role     = integer: 3=regular user, 4=superuser, -1=blocked (NOT a string)
      //   full_name = display name
      const basePayload: Record<string, unknown> = {
        name: params.clientEmail,       // login name = email address
        full_name: params.businessName, // display name
        email: params.clientEmail,
        password: subPassword,
        password_confirmation: subPassword,
        role: 3,                        // 3 = regular user (integer, not string)
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
              const allUsers: Record<string, unknown>[] = Array.isArray(usersResp) ? usersResp : ((usersResp as Record<string, unknown>)?.users as Record<string, unknown>[] || []);
              const existing = allUsers.find((u) => u.email === params.clientEmail);
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

      const user = Array.isArray(userResult) ? userResult[0] : ((userResult as Record<string, unknown>)?.user || userResult) as Record<string, unknown>;
      subUserId = user?.id as number | undefined;
      subUserEmail = params.clientEmail;
      console.log(`[SuperSaas] Sub-user ready: id=${subUserId} email=${params.clientEmail}`);
    } catch (userErr) {
      // Sub-user creation is non-fatal — schedule still works without it
      // (client just won't have their own login; they use the embed iframe)
      console.warn("[SuperSaas] Sub-user creation failed (non-fatal):", (userErr as Error).message);
    }

    // Base schedule URL (master account owns the schedule)
    const baseUrl = `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(actualName)}`;

    // Security: do NOT embed credentials in public iframe/booking URLs.
    // ?user=email&password=xxx in the URL exposes the sub-user password in:
    //   - browser history, server logs, referrer headers, the generated HTML, and emails.
    // The plain baseUrl is sufficient for the public booking iframe — SuperSaas shows it
    // without requiring login. The sub-user credentials are returned separately so they
    // can be given to the client privately (e.g. welcome email) for their admin login only.
    const embedUrl = baseUrl;

    return {
      id,
      name: actualName,
      embedUrl,
      bookUrl: baseUrl,
      subUserId,
      subUserEmail,
      // subUserPassword is intentionally omitted from the return value to prevent it
      // from leaking into job records, HTML, or URLs. It is only used above during
      // sub-user creation and is not stored anywhere downstream.
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

function parseAppointment(a: Record<string, unknown>): SuperSaasAppointment {
  return {
    id:         a.id as number,
    scheduleId: a.schedule_id as number,
    start:      (a.start || a.slot_start || "") as string,
    finish:     (a.finish || a.slot_end || "") as string,
    status:     (a.status || "confirmed") as string,
    fullName:   (a.full_name || a.name || "") as string,
    email:      (a.email || "") as string,
    phone:      (a.mobile || a.phone || "") as string,
    description: (a.description || "") as string,
    createdOn:  (a.created_on || "") as string,
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
  } catch {
    return false;
  }
}
