// lib/synergy.ts
// Synergy Wholesale domain registration via SOAP API
// Demo mode: set SYNERGY_DEMO=true to skip actual API calls (dry-run)
//
// Required env vars (production):
//   SYNERGY_RESELLER_ID   — your numeric reseller ID
//   SYNERGY_API_KEY       — your API key from Synergy portal
//   SYNERGY_DEMO          — "true" to enable dry-run mode (no real purchases)
//
// Flow for each new client site:
//   1. checkDomain()        — verify the domain is available
//   2. registerDomain()     — register it (AU domains use domainRegisterAU)
//   3. updateNameServers()  — point it at Vercel's nameservers

const SYNERGY_ENDPOINT = "https://api.synergywholesale.com/";
const VERCEL_NAMESERVERS = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];

function isDemo(): boolean {
  return process.env.SYNERGY_DEMO === "true";
}

function buildSoapEnvelope(method: string, params: Record<string, string | number>): string {
  const resellerId = process.env.SYNERGY_RESELLER_ID || "";
  const apiKey = process.env.SYNERGY_API_KEY || "";

  const paramXml = Object.entries({ resellerID: resellerId, apiKey, ...params })
    .map(([k, v]) => `<${k}>${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</${k}>`)
    .join("\n        ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns1="http://www.synergywholesale.com/">
  <SOAP-ENV:Body>
    <ns1:${method}>
      ${paramXml}
    </ns1:${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

async function soapCall(method: string, params: Record<string, string | number>): Promise<Record<string, string>> {
  const envelope = buildSoapEnvelope(method, params);
  const res = await fetch(SYNERGY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `"${method}"`,
    },
    body: envelope,
  });

  const text = await res.text();

  // Parse the simple flat key-value response Synergy returns
  const result: Record<string, string> = {};
  const matches = text.matchAll(/<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g);
  for (const [, key, value] of matches) {
    if (!["Envelope", "Body", "return"].includes(key)) {
      result[key] = value.trim();
    }
  }

  return result;
}

// ── Domain availability check ─────────────────────────────────────────────────
export async function checkDomain(domainName: string): Promise<{
  available: boolean;
  status: string;
  price?: string;
}> {
  if (isDemo()) {
    console.log(`[Synergy DEMO] checkDomain: ${domainName} → available`);
    return { available: true, status: "available", price: "15.00" };
  }

  const r = await soapCall("checkDomain", { domainName });
  console.log(`[Synergy] checkDomain ${domainName}:`, r);

  return {
    available: r.status === "available",
    status: r.status || "unknown",
    price: r.price,
  };
}

// ── Domain registration ────────────────────────────────────────────────────────
// Automatically picks domainRegisterAU for .com.au / .net.au / .org.au / .id.au
// and domainRegister for everything else.
export async function registerDomain(params: {
  domainName: string;
  years?: number;
  // Registrant contact details
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;   // format: +61.412345678
  contactAddress: string;
  contactCity: string;
  contactState: string;
  contactPostcode: string;
  contactCountry?: string;
  // AU-specific eligibility (required for .com.au etc.)
  auEligibilityType?: string;   // e.g. "ABN"
  auEligibilityName?: string;   // registered entity name
  auEligibilityId?: string;     // ABN number
}): Promise<{ success: boolean; status: string; domainName: string; expiryDate?: string }> {
  const domain = params.domainName.toLowerCase().trim();
  const years = params.years || 2;

  if (isDemo()) {
    console.log(`[Synergy DEMO] registerDomain: ${domain} (${years}yr) → success`);
    return {
      success: true,
      status: "Active",
      domainName: domain,
      expiryDate: new Date(Date.now() + years * 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
    };
  }

  const isAU = /\.(com\.au|net\.au|org\.au|id\.au|asn\.au|edu\.au)$/.test(domain);

  const baseParams: Record<string, string | number> = {
    domainName: domain,
    years,
    contactFirstName: params.contactFirstName,
    contactLastName: params.contactLastName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    contactAddress: params.contactAddress,
    contactCity: params.contactCity,
    contactState: params.contactState,
    contactPostcode: params.contactPostcode,
    contactCountry: params.contactCountry || "AU",
    // Use Vercel nameservers from the start
    ns1: VERCEL_NAMESERVERS[0],
    ns2: VERCEL_NAMESERVERS[1],
  };

  if (isAU) {
    baseParams.eligibilityType = params.auEligibilityType || "ABN";
    baseParams.eligibilityName = params.auEligibilityName || params.contactFirstName + " " + params.contactLastName;
    if (params.auEligibilityId) baseParams.eligibilityId = params.auEligibilityId;
  }

  const method = isAU ? "domainRegisterAU" : "domainRegister";
  const r = await soapCall(method, baseParams);
  console.log(`[Synergy] ${method} ${domain}:`, r);

  const success = r.status === "Active" || r.status === "Pending" || r.result === "OK";

  return {
    success,
    status: r.status || r.result || "unknown",
    domainName: domain,
    expiryDate: r.expiryDate,
  };
}

// ── Update nameservers ─────────────────────────────────────────────────────────
// Called after registration if nameservers weren't set during registration,
// or if domain was transferred in.
export async function updateNameServers(domainName: string, nameservers?: string[]): Promise<boolean> {
  const ns = nameservers || VERCEL_NAMESERVERS;

  if (isDemo()) {
    console.log(`[Synergy DEMO] updateNameServers: ${domainName} → ${ns.join(", ")}`);
    return true;
  }

  const r = await soapCall("updateNameServers", {
    domainName,
    ns1: ns[0],
    ns2: ns[1],
    ...(ns[2] ? { ns3: ns[2] } : {}),
    ...(ns[3] ? { ns4: ns[3] } : {}),
  });

  console.log(`[Synergy] updateNameServers ${domainName}:`, r);
  return r.result === "OK" || r.status === "OK";
}

// ── Get domain info ───────────────────────────────────────────────────────────
export async function getDomainInfo(domainName: string): Promise<Record<string, string>> {
  if (isDemo()) {
    return { status: "Active", domainName, ns1: VERCEL_NAMESERVERS[0], ns2: VERCEL_NAMESERVERS[1] };
  }
  return soapCall("domainInfo", { domainName });
}

// ── Balance check ─────────────────────────────────────────────────────────────
export async function getBalance(): Promise<number> {
  if (isDemo()) {
    console.log("[Synergy DEMO] getBalance → $999.00");
    return 999;
  }
  const r = await soapCall("balanceQuery", {});
  return parseFloat(r.balance || "0");
}

// ── Full registration flow ────────────────────────────────────────────────────
// Convenience wrapper: check → register → confirm nameservers
// Returns the domain URL or throws on failure.
export async function provisionClientDomain(params: {
  domainName: string;
  businessName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress?: string;
  contactCity?: string;
  contactState?: string;
  contactPostcode?: string;
  auEligibilityType?: string;
  auEligibilityName?: string;
  auEligibilityId?: string;
}): Promise<{ url: string; domainName: string; status: string }> {
  const domain = params.domainName.toLowerCase().trim();

  // 1. Check availability
  const check = await checkDomain(domain);
  if (!check.available) {
    throw new Error(`Domain "${domain}" is not available (status: ${check.status})`);
  }

  // 2. Register
  const reg = await registerDomain({
    domainName: domain,
    years: 2,
    contactFirstName: params.contactFirstName,
    contactLastName: params.contactLastName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    contactAddress: params.contactAddress || "Australia",
    contactCity: params.contactCity || "Sydney",
    contactState: params.contactState || "NSW",
    contactPostcode: params.contactPostcode || "2000",
    auEligibilityType: params.auEligibilityType,
    auEligibilityName: params.auEligibilityName || params.businessName,
    auEligibilityId: params.auEligibilityId,
  });

  if (!reg.success) {
    throw new Error(`Domain registration failed for "${domain}": ${reg.status}`);
  }

  // 3. Nameservers are set during registration, but confirm if needed
  // (Synergy sometimes ignores ns params on AU domains — re-set to be safe)
  await updateNameServers(domain);

  const url = `https://${domain}`;
  console.log(`[Synergy] Domain provisioned: ${url} (expires: ${reg.expiryDate || "unknown"})`);
  return { url, domainName: domain, status: reg.status };
}
