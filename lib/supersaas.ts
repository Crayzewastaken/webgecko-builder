// lib/supersaas.ts
// SuperSaas API helper — auto-creates a booking schedule under the master WebGecko account.
// Docs: https://www.supersaas.com/info/dev/api

const SS_ACCOUNT = process.env.SUPERSAAS_ACCOUNT_NAME!;
const SS_API_KEY  = process.env.SUPERSAAS_API_KEY!;
const SS_BASE     = "https://www.supersaas.com/api";

async function ssRequest(path: string, method = "GET", body?: Record<string, any>) {
  const url = `${SS_BASE}${path}.json?account=${encodeURIComponent(SS_ACCOUNT)}&api_key=${encodeURIComponent(SS_API_KEY)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SuperSaas API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

export interface SuperSaasSchedule {
  id: number;
  name: string;
  embedUrl: string;   // iframe src
  bookUrl: string;    // direct booking link
}

/**
 * Creates a new appointment schedule for a client.
 * Returns the schedule ID and embed URLs.
 */
export async function createSuperSaasSchedule(params: {
  businessName: string;
  clientEmail: string;
  timezone?: string;
}): Promise<SuperSaasSchedule | null> {
  if (!SS_ACCOUNT || !SS_API_KEY) {
    console.warn("[SuperSaas] API keys not set — skipping schedule creation");
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
        fields: [
          { name: "name",    label: "Full Name",     required: true  },
          { name: "email",   label: "Email Address", required: true  },
          { name: "phone",   label: "Phone Number",  required: false },
          { name: "comment", label: "Notes",         required: false },
        ],
        notification: params.clientEmail,
      },
    });

    const id = result?.id || result?.schedule?.id;
    if (!id) throw new Error("No schedule ID in response: " + JSON.stringify(result).slice(0, 200));

    console.log(`[SuperSaas] Created schedule "${slugName}" id=${id} for "${params.businessName}"`);

    return {
      id,
      name: slugName,
      embedUrl: `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(slugName)}`,
      bookUrl:  `https://www.supersaas.com/schedule/${encodeURIComponent(SS_ACCOUNT)}/${encodeURIComponent(slugName)}`,
    };
  } catch (err) {
    console.error("[SuperSaas] Failed to create schedule:", err);
    return null;
  }
}

/**
 * Generates the HTML to inject into id="booking" — either a SuperSaas iframe
 * or a styled button linking to the client's own booking URL.
 */
export function generateBookingEmbed(params: {
  bookingUrl: string;
  businessName: string;
  primaryColor?: string;
}): string {
  const { bookingUrl, businessName, primaryColor = "#10b981" } = params;

  return `<section id="booking" style="padding:80px 24px;background:#0a0f1a;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 style="color:#f1f5f9;font-size:2.2rem;font-weight:900;margin-bottom:8px;">Book an Appointment</h2>
    <p style="color:#94a3b8;margin-bottom:32px;">Schedule your appointment with ${businessName} online — fast and easy.</p>
    <div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">
      <iframe
        src="${bookingUrl}"
        width="100%"
        height="700"
        frameborder="0"
        scrolling="auto"
        style="display:block;background:#fff;"
        title="Book an Appointment"
        loading="lazy"
      ></iframe>
    </div>
    <p style="color:#475569;font-size:12px;margin-top:16px;">
      Prefer to call? <a href="tel:" style="color:${primaryColor};">Phone us directly</a>
    </p>
  </div>
</section>`;
}
