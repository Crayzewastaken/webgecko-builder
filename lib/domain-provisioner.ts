// lib/domain-provisioner.ts
// Smart domain provisioner — single entry point for all domain registration.
//
// Routing logic:
//   .com.au / .net.au / .org.au / .id.au / .asn.au / .edu.au
//     → Register via Synergy Wholesale (only AU-accredited registrar)
//     → Create Cloudflare zone + DNS records
//     → Update Synergy nameservers → Cloudflare NS
//
//   .com / .net / .org / .io / .ai / .co etc
//     → Register via Cloudflare Registrar (at-cost, auto-NS)
//     → Cloudflare zone created automatically on registration
//     → Add DNS records pointing at Vercel
//
// Both paths:
//   → Add domain to Vercel project
//   → Return nameservers + zoneId for storage in jobs.metadata
//
// Required env vars:
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (see lib/cloudflare.ts)
//   SYNERGY_RESELLER_ID, SYNERGY_API_KEY       (see lib/synergy.ts)
//   VERCEL_API_TOKEN                            (already set)

import {
  createZone,
  getZone,
  upsertVercelDnsRecords,
  pauseZone,
  deleteZone,
  isCloudflareRegistrarSupported,
  checkDomainAvailability,
  registerDomainCF,
  addDomainToVercelProject,
  removeDomainFromVercelProject,
  type DomainContact,
} from "./cloudflare";

import {
  checkDomain as checkDomainSynergy,
  registerDomain as registerDomainSynergy,
  updateNameServers as updateSynergyNameservers,
} from "./synergy";

// ── AU TLD detection ──────────────────────────────────────────────────────────

const AU_TLDS = /\.(com\.au|net\.au|org\.au|id\.au|asn\.au|edu\.au)$/i;

export function isAuDomain(domain: string): boolean {
  return AU_TLDS.test(domain.toLowerCase());
}

export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface DomainProvisionResult {
  url: string;
  domainName: string;
  status: string;
  registrar: "cloudflare" | "synergy";
  zoneId: string;
  nameservers: string[];
  expiryDate?: string;
  vercelAdded: boolean;
}

export interface ProvisionParams {
  domainName: string;
  businessName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;     // raw Australian phone — we normalise it
  contactAddress?: string;
  contactCity?: string;
  contactState?: string;
  contactPostcode?: string;
  abn?: string;             // required for .com.au ABN eligibility
  // Which Vercel project to attach the domain to
  vercelProjectName: string;
  // Set true to skip actual API calls (dry-run / test)
  demoMode?: boolean;
}

// ── Phone normalisation ───────────────────────────────────────────────────────

function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+61")) return digits;
  if (digits.startsWith("61")) return "+" + digits;
  if (digits.startsWith("0")) return "+61" + digits.slice(1);
  return "+61" + digits;
}

// ── Main provisioner ──────────────────────────────────────────────────────────

/**
 * Full domain provisioning flow.
 * Registers the domain, creates Cloudflare zone, sets DNS records,
 * attaches domain to the Vercel project.
 *
 * Non-throwing: catches individual step failures and logs them.
 * Returns the best result we could achieve even on partial failure.
 */
export async function provisionDomain(params: ProvisionParams): Promise<DomainProvisionResult> {
  const domain    = normalizeDomain(params.domainName);
  const isAU      = isAuDomain(domain);
  const isDemo    = params.demoMode || process.env.SYNERGY_DEMO === "true";
  const registrar = isAU ? "synergy" : "cloudflare";

  console.log(`[DomainProvisioner] Starting for ${domain} — registrar: ${registrar}, demo: ${isDemo}`);

  const contact: DomainContact = {
    firstName: params.contactFirstName,
    lastName:  params.contactLastName,
    email:     params.contactEmail,
    phone:     normalisePhone(params.contactPhone || "0400000000"),
    address:   params.contactAddress  || "Australia",
    city:      params.contactCity     || "Sydney",
    state:     params.contactState    || "NSW",
    postcode:  params.contactPostcode || "2000",
    country:   "AU",
  };

  let registrationStatus = "pending";
  let expiryDate: string | undefined;

  // ── Step 1: Register domain ──────────────────────────────────────────────────
  if (isDemo) {
    console.log(`[DomainProvisioner] DEMO — skipping real registration for ${domain}`);
    registrationStatus = "demo";
  } else if (isAU) {
    // Synergy path — .com.au etc
    try {
      const available = await checkDomainSynergy(domain);
      if (!available.available) {
        console.warn(`[DomainProvisioner] ${domain} not available via Synergy (status: ${available.status}) — skipping registration`);
      } else {
        const reg = await registerDomainSynergy({
          domainName: domain,
          years: 2,
          contactFirstName: contact.firstName,
          contactLastName:  contact.lastName,
          contactEmail:     contact.email,
          contactPhone:     contact.phone,
          contactAddress:   contact.address,
          contactCity:      contact.city,
          contactState:     contact.state,
          contactPostcode:  contact.postcode,
          contactCountry:   "AU",
          auEligibilityType: "ABN",
          auEligibilityName: params.abn ? params.businessName : contact.firstName + " " + contact.lastName,
          auEligibilityId:  params.abn,
          // Nameservers set to Cloudflare AFTER zone creation (see step 3)
        });
        registrationStatus = reg.status;
        expiryDate = reg.expiryDate;
        if (!reg.success) {
          console.warn(`[DomainProvisioner] Synergy registration returned: ${reg.status}`);
        }
      }
    } catch (e) {
      console.error(`[DomainProvisioner] Synergy registration error (non-fatal):`, e);
    }
  } else {
    // Cloudflare Registrar path — gTLDs
    if (!isCloudflareRegistrarSupported(domain)) {
      console.warn(`[DomainProvisioner] ${domain} TLD not supported by Cloudflare Registrar — skipping registration (manual action needed)`);
    } else {
      try {
        const avail = await checkDomainAvailability(domain);
        if (!avail.available) {
          console.warn(`[DomainProvisioner] ${domain} not available via Cloudflare (may already be registered or taken)`);
        } else {
          const reg = await registerDomainCF(domain, contact, 1);
          registrationStatus = reg.status;
          expiryDate = reg.expiryDate;
          if (!reg.success) {
            console.warn(`[DomainProvisioner] Cloudflare registration returned: ${reg.status}`);
          }
        }
      } catch (e) {
        console.error(`[DomainProvisioner] Cloudflare registration error (non-fatal):`, e);
      }
    }
  }

  // ── Step 2: Create (or retrieve) Cloudflare zone ─────────────────────────────
  let zoneId = "";
  let nameservers: string[] = [];

  try {
    if (isDemo) {
      console.log(`[DomainProvisioner] DEMO — skipping zone creation`);
      zoneId = "demo-zone-id";
      nameservers = ["ns1.cloudflare.com", "ns2.cloudflare.com"];
    } else {
      const zone = await createZone(domain);
      zoneId      = zone.id;
      nameservers = zone.name_servers || [];
      console.log(`[DomainProvisioner] Zone ready: ${zoneId}, NS: ${nameservers.join(", ")}`);
    }
  } catch (e) {
    console.error(`[DomainProvisioner] Zone creation failed (non-fatal):`, e);
  }

  // ── Step 3: Set DNS records pointing at Vercel ──────────────────────────────
  if (zoneId && zoneId !== "demo-zone-id") {
    try {
      await upsertVercelDnsRecords(zoneId, domain);
    } catch (e) {
      console.error(`[DomainProvisioner] DNS record upsert failed (non-fatal):`, e);
    }
  }

  // ── Step 4: Update Synergy nameservers → Cloudflare ──────────────────────────
  // Only needed for AU domains (Cloudflare Registrar sets its own NS automatically).
  if (isAU && nameservers.length > 0 && !isDemo) {
    try {
      await updateSynergyNameservers(domain, nameservers);
      console.log(`[DomainProvisioner] Synergy NS updated to Cloudflare: ${nameservers.join(", ")}`);
    } catch (e) {
      console.error(`[DomainProvisioner] Synergy NS update failed (non-fatal):`, e);
    }
  }

  // ── Step 5: Add domain to Vercel project ────────────────────────────────────
  let vercelAdded = false;
  try {
    if (isDemo) {
      console.log(`[DomainProvisioner] DEMO — skipping Vercel domain attachment`);
      vercelAdded = true;
    } else {
      await addDomainToVercelProject(domain, params.vercelProjectName);
      vercelAdded = true;
    }
  } catch (e) {
    console.error(`[DomainProvisioner] Vercel domain attachment failed (non-fatal):`, e);
  }

  const result: DomainProvisionResult = {
    url:         `https://${domain}`,
    domainName:  domain,
    status:      registrationStatus,
    registrar,
    zoneId,
    nameservers,
    expiryDate,
    vercelAdded,
  };

  console.log(`[DomainProvisioner] Complete:`, JSON.stringify(result));
  return result;
}

// ── Suspension ────────────────────────────────────────────────────────────────

/**
 * Suspend a domain on payment cancellation.
 * - Pauses the Cloudflare zone (traffic still resolves but CDN/proxy disabled)
 * - Removes the domain from the Vercel project
 *
 * Does NOT delete the zone or cancel the domain registration —
 * those are intentional actions that require manual operator review.
 */
export async function suspendDomain(
  domain: string,
  vercelProjectName: string,
  opts: { deleteZone?: boolean } = {}
): Promise<void> {
  const normalized = normalizeDomain(domain);
  console.log(`[DomainProvisioner] Suspending ${normalized}`);

  // 1. Remove from Vercel project (site goes offline)
  try {
    await removeDomainFromVercelProject(normalized, vercelProjectName);
  } catch (e) {
    console.warn(`[DomainProvisioner] Vercel domain removal failed:`, e);
  }

  // 2. Pause or delete Cloudflare zone
  try {
    const zone = await getZone(normalized);
    if (zone) {
      if (opts.deleteZone) {
        await deleteZone(zone.id);
      } else {
        await pauseZone(zone.id);
      }
    } else {
      console.log(`[DomainProvisioner] No Cloudflare zone found for ${normalized} — nothing to pause`);
    }
  } catch (e) {
    console.warn(`[DomainProvisioner] Zone pause/delete failed:`, e);
  }
}

// ── Re-activate ───────────────────────────────────────────────────────────────

/**
 * Re-activate a previously suspended domain.
 * Un-pauses the Cloudflare zone and re-attaches to Vercel project.
 */
export async function reactivateDomain(
  domain: string,
  vercelProjectName: string
): Promise<void> {
  const normalized = normalizeDomain(domain);
  console.log(`[DomainProvisioner] Re-activating ${normalized}`);

  try {
    const zone = await getZone(normalized);
    if (zone) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: false }),
      });
      if (res.ok) console.log(`[DomainProvisioner] Zone ${zone.id} un-paused`);
    }
  } catch (e) {
    console.warn(`[DomainProvisioner] Zone un-pause failed:`, e);
  }

  try {
    await addDomainToVercelProject(normalized, vercelProjectName);
  } catch (e) {
    console.warn(`[DomainProvisioner] Vercel domain re-attach failed:`, e);
  }
}
