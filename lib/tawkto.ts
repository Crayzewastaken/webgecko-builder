// lib/tawkto.ts
// Tawk.to REST API helper — creates a property (chat widget) per client.
// Docs: https://developer.tawk.to/restapi/

const TAWKTO_API_KEY = process.env.TAWKTO_API_KEY!;
const TAWKTO_BASE = "https://api.tawk.to/v1";

async function tawkRequest(path: string, method = "GET", body?: Record<string, any>) {
  const res = await fetch(`${TAWKTO_BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${Buffer.from(`${TAWKTO_API_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tawk.to API error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Creates a new Tawk.to property for a client and returns the property ID.
 * The property ID is used in the embed script: embed.tawk.to/{propertyId}/default
 */
export async function createTawktoProperty(businessName: string): Promise<string | null> {
  if (!TAWKTO_API_KEY) {
    console.warn("[Tawk.to] TAWKTO_API_KEY not set — skipping live chat setup");
    return null;
  }
  try {
    const result = await tawkRequest("/properties", "POST", {
      name: businessName,
      timezone: "Australia/Brisbane",
    });
    // Returns { _id, ... } — the _id is the property ID used in embed URL
    const propertyId = result?.data?._id || result?._id;
    if (!propertyId) throw new Error("No property ID in response: " + JSON.stringify(result));
    console.log(`[Tawk.to] Created property for "${businessName}": ${propertyId}`);
    return propertyId;
  } catch (err) {
    console.error("[Tawk.to] Failed to create property:", err);
    return null;
  }
}

/**
 * Gets all properties for the account.
 */
export async function listTawktoProperties() {
  if (!TAWKTO_API_KEY) return [];
  try {
    const result = await tawkRequest("/properties");
    return result?.data || [];
  } catch (err) {
    console.error("[Tawk.to] Failed to list properties:", err);
    return [];
  }
}
