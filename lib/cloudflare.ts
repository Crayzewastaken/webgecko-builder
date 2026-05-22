// lib/cloudflare.ts
// Cloudflare API client — Zone/DNS management + Registrar (gTLDs only).
//
// Required env vars:
//   CLOUDFLARE_API_TOKEN   — API token with Zone:Edit + DNS:Edit + Registrar:Edit
//   CLOUDFLARE_ACCOUNT_ID  — Your Cloudflare account ID (Settings → Account ID)
//
// Permissions needed on the API token:
//   Zone: Zone Read, Zone Edit, DNS Read, DNS Edit
//   Account: Registrar Read, Registrar Write  (for domain registration)
//
// Cloudflare docs: https://developers.cloudflare.com/api/

const CF_BASE = "https://api.cloudflare.com/client/v4";

function cfHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function accountId() {
  return process.env.CLOUDFLARE_ACCOUNT_ID || "";
}

async function cfFetch(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: { ...cfHeaders(), ...(options?.headers || {}) },
  });
  const data = await res.json();
  if (!data.success) {
    const errs = (data.errors || []).map((e: any) => `[${e.code}] ${e.message}`).join("; ");
    throw new Error(`Cloudflare API error on ${path}: ${errs || res.statusText}`);
  }
  return data.result;
}

// ── Zone management ───────────────────────────────────────────────────────────

export interface CloudflareZone {
  id: string;
  name: string;
  name_servers: string[];
  status: string;
}

/**
 * Creates a Cloudflare zone for full DNS management.
 * If the zone already exists, returns the existing one instead of erroring.
 */
export async function createZone(domain: string): Promise<CloudflareZone> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");

  // Check if zone already exists
  const existing = await getZone(normalized);
  if (existing) {
    console.log(`[Cloudflare] Zone already exists for ${normalized}: ${existing.id}`);
    return existing;
  }

  const result = await cfFetch("/zones", {
    method: "POST",
    body: JSON.stringify({
      name: normalized,
      account: { id: accountId() },
      jump_start: false,
      type: "full",
    }),
  });

  console.log(`[Cloudflare] Zone created: ${result.id} for ${normalized}`);
  console.log(`[Cloudflare] Nameservers: ${result.name_servers?.join(", ")}`);
  return result as CloudflareZone;
}

/** Look up an existing zone by domain name. Returns null if not found. */
export async function getZone(domain: string): Promise<CloudflareZone | null> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  try {
    const results = await cfFetch(`/zones?name=${encodeURIComponent(normalized)}&account.id=${accountId()}`);
    if (Array.isArray(results) && results.length > 0) return results[0] as CloudflareZone;
    return null;
  } catch {
    return null;
  }
}

/** Pause a zone (stops Cloudflare proxying — useful for suspension). */
export async function pauseZone(zoneId: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify({ paused: true }),
  });
  console.log(`[Cloudflare] Zone ${zoneId} paused`);
}

/** Delete a zone entirely from Cloudflare. */
export async function deleteZone(zoneId: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}`, { method: "DELETE" });
  console.log(`[Cloudflare] Zone ${zoneId} deleted`);
}

// ── DNS records ───────────────────────────────────────────────────────────────

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

/**
 * Upsert DNS records for a Vercel-hosted site.
 * Creates or replaces:
 *   @    CNAME  → cname.vercel-dns.com  (proxied = true for CDN)
 *   www  CNAME  → cname.vercel-dns.com
 *
 * Vercel also requires the domain to be added to the project (see addDomainToVercelProject).
 * Proxied=true means traffic flows through Cloudflare — CDN + DDoS protection active.
 */
export async function upsertVercelDnsRecords(zoneId: string, domain: string): Promise<void> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const vercelCname = "cname.vercel-dns.com";

  // Fetch existing records
  const existing: DnsRecord[] = await cfFetch(`/zones/${zoneId}/dns_records?per_page=100`);

  const toUpsert = [
    { type: "CNAME", name: normalized,        content: vercelCname, proxied: true },
    { type: "CNAME", name: `www.${normalized}`, content: vercelCname, proxied: true },
  ];

  for (const record of toUpsert) {
    const match = existing.find(r => r.type === record.type && r.name === record.name);
    if (match) {
      if (match.content === record.content) {
        console.log(`[Cloudflare] DNS record already correct: ${record.name} → ${record.content}`);
        continue;
      }
      await cfFetch(`/zones/${zoneId}/dns_records/${match.id}`, {
        method: "PUT",
        body: JSON.stringify(record),
      });
      console.log(`[Cloudflare] DNS record updated: ${record.name} CNAME → ${record.content}`);
    } else {
      await cfFetch(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify(record),
      });
      console.log(`[Cloudflare] DNS record created: ${record.name} CNAME → ${record.content}`);
    }
  }
}

// ── Registrar — gTLD domain registration ─────────────────────────────────────
// NOTE: Cloudflare Registrar only supports gTLDs (.com, .net, .org, .io, .co, etc.)
// Australian ccTLDs (.com.au, .net.au, etc.) must go through an AU registrar (Synergy).
// Supported TLDs: https://www.cloudflare.com/tld-policies/

/** TLDs Cloudflare Registrar supports. Not exhaustive — this covers common ones. */
const CF_SUPPORTED_TLDS = new Set([
  "com", "net", "org", "info", "biz", "io", "co", "app", "dev", "ai",
  "me", "cc", "tv", "fm", "link", "online", "site", "web", "store",
  "shop", "tech", "digital", "agency", "studio", "design", "media",
  "services", "solutions", "cloud", "software",
]);

export function isCloudflareRegistrarSupported(domain: string): boolean {
  const parts = domain.split(".");
  const tld = parts[parts.length - 1].toLowerCase();
  const sld = parts.length > 2 ? parts.slice(-2).join(".") : "";
  // Never handle AU ccTLDs
  if (["au", "nz", "uk", "ca", "de", "fr"].includes(tld)) return false;
  // Second-level country codes like co.uk
  if (["co.uk", "org.uk", "co.nz"].includes(sld)) return false;
  return CF_SUPPORTED_TLDS.has(tld);
}

export interface DomainContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;       // E.164 format: +61412345678
  address: string;
  city: string;
  state: string;
  postcode: string;
  country: string;     // ISO 2-letter: "AU"
}

export interface RegistrarCheckResult {
  available: boolean;
  price?: number;
  currency?: string;
  tld?: string;
}

/** Check if a domain is available via Cloudflare Registrar. */
export async function checkDomainAvailability(domain: string): Promise<RegistrarCheckResult> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  try {
    const result = await cfFetch(
      `/accounts/${accountId()}/registrar/domains/search?query=${encodeURIComponent(normalized)}`
    );
    // result is an array of available domains
    const match = Array.isArray(result) ? result.find((r: any) => r.name === normalized) : null;
    if (match) {
      return { available: true, price: match.price, currency: match.currency, tld: match.tld };
    }
    return { available: false };
  } catch (e) {
    console.warn(`[Cloudflare] Domain availability check failed for ${normalized}:`, e);
    return { available: false };
  }
}

export interface RegisterDomainResult {
  success: boolean;
  domainName: string;
  status: string;
  expiryDate?: string;
}

/**
 * Register a gTLD domain via Cloudflare Registrar.
 * Billed to the Cloudflare account's payment method at cost price.
 * Throws if the domain is an AU ccTLD — use Synergy for those.
 */
export async function registerDomainCF(
  domain: string,
  contact: DomainContact,
  years = 1
): Promise<RegisterDomainResult> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");

  if (!isCloudflareRegistrarSupported(normalized)) {
    throw new Error(
      `[Cloudflare] Domain "${normalized}" is not supported by Cloudflare Registrar. Use Synergy for AU ccTLDs.`
    );
  }

  const body = {
    name: normalized,
    years,
    registrant_contact: {
      first_name:   contact.firstName,
      last_name:    contact.lastName,
      email:        contact.email,
      phone:        contact.phone,
      address:      contact.address,
      city:         contact.city,
      state:        contact.state,
      zip:          contact.postcode,
      country:      contact.country || "AU",
    },
    // Let Cloudflare manage nameservers automatically — they'll use their own NS
    // which is exactly what we want (Cloudflare DNS from day 1).
    nameservers: { type: "cloudflare" },
    privacy_is_enabled: true,
    auto_renew: true,
  };

  const result = await cfFetch(`/accounts/${accountId()}/registrar/domains`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(`[Cloudflare] Domain registered: ${normalized}`, result?.status);

  return {
    success: result?.status === "active" || result?.status === "pending",
    domainName: normalized,
    status: result?.status || "pending",
    expiryDate: result?.expires_at,
  };
}

// ── Vercel domain wiring ──────────────────────────────────────────────────────

/**
 * Add a custom domain to a Vercel project.
 * Must be called after Cloudflare DNS is pointed at cname.vercel-dns.com.
 */
export async function addDomainToVercelProject(
  domain: string,
  vercelProjectName: string
): Promise<void> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const domains = [normalized, `www.${normalized}`];

  for (const d of domains) {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectName)}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: d }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      // 409 = domain already added — not an error
      if (res.status === 409) {
        console.log(`[Vercel] Domain ${d} already on project — skipping`);
        continue;
      }
      console.warn(`[Vercel] Failed to add domain ${d} to project ${vercelProjectName}: ${err.slice(0, 200)}`);
    } else {
      console.log(`[Vercel] Domain ${d} added to project ${vercelProjectName}`);
    }
  }
}

/** Remove a custom domain from a Vercel project (used on subscription cancellation). */
export async function removeDomainFromVercelProject(
  domain: string,
  vercelProjectName: string
): Promise<void> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const domains = [normalized, `www.${normalized}`];

  for (const d of domains) {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectName)}/domains/${encodeURIComponent(d)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
      }
    );
    if (res.ok || res.status === 404) {
      console.log(`[Vercel] Domain ${d} removed from project`);
    } else {
      const err = await res.text();
      console.warn(`[Vercel] Failed to remove domain ${d}: ${err.slice(0, 200)}`);
    }
  }
}
