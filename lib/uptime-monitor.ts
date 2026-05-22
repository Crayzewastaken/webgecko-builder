// lib/uptime-monitor.ts
// Uptime check logic for all active WebGecko client sites.
// Called by the Inngest scheduled function every 30 minutes.

import { supabase } from "./supabase";

export interface UptimeResult {
  jobId: string;
  slug: string;
  businessName: string;
  url: string;
  status: "up" | "down" | "slow";
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  error?: string;
}

/** Ping a single URL. Returns latency in ms and HTTP status code. */
async function pingUrl(url: string, timeoutMs = 10000): Promise<{ statusCode: number; latencyMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "WebGecko-UptimeMonitor/1.0" },
      // Don't follow redirect chains — we want to know the direct response
      redirect: "manual",
    });
    clearTimeout(timer);
    return { statusCode: res.status, latencyMs: Date.now() - start };
  } catch (e: any) {
    clearTimeout(timer);
    throw new Error(e?.name === "AbortError" ? "timeout" : (e?.message || "fetch failed"));
  }
}

/** Check all active launched client sites and return results. */
export async function checkAllSites(): Promise<UptimeResult[]> {
  // Fetch all clients that have a live URL and are marked launch_ready
  const { data: clients, error } = await supabase
    .from("clients")
    .select("slug, job_id, domain, business_name")
    .eq("launch_ready", true);

  if (error) throw new Error(`[UptimeMonitor] Could not fetch clients: ${error.message}`);
  if (!clients || clients.length === 0) return [];

  // Also grab vercel project names from jobs for clients without a custom domain
  const jobIds = clients.map(c => c.job_id).filter(Boolean);
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, preview_url, vercel_project_name")
    .in("id", jobIds);

  const jobMap: Record<string, { previewUrl?: string; vercelProjectName?: string }> = {};
  for (const j of jobs || []) {
    jobMap[j.id] = { previewUrl: j.preview_url, vercelProjectName: j.vercel_project_name };
  }

  const results: UptimeResult[] = [];
  const checkedAt = new Date().toISOString();

  await Promise.allSettled(
    clients.map(async (client) => {
      const job = jobMap[client.job_id] || {};
      const url =
        (client.domain ? `https://${client.domain}` : null) ||
        job.previewUrl ||
        (job.vercelProjectName ? `https://${job.vercelProjectName}.vercel.app` : null);

      if (!url) return; // No URL to check

      let result: UptimeResult = {
        jobId:        client.job_id,
        slug:         client.slug,
        businessName: client.business_name || client.slug,
        url,
        status:       "up",
        statusCode:   null,
        latencyMs:    null,
        checkedAt,
      };

      try {
        const { statusCode, latencyMs } = await pingUrl(url);
        result.statusCode = statusCode;
        result.latencyMs  = latencyMs;

        if (statusCode >= 500) {
          result.status = "down";
        } else if (statusCode >= 400 || latencyMs > 8000) {
          result.status = "slow";
        } else {
          result.status = "up";
        }
      } catch (e: any) {
        result.status = "down";
        result.error  = e?.message || "unknown error";
      }

      results.push(result);
    })
  );

  return results;
}

/** Persist uptime results to Supabase and return sites that are down. */
export async function saveUptimeResults(results: UptimeResult[]) {
  if (results.length === 0) return;

  // Upsert into uptime_checks table (created by migration)
  const rows = results.map(r => ({
    job_id:        r.jobId,
    slug:          r.slug,
    url:           r.url,
    status:        r.status,
    status_code:   r.statusCode,
    latency_ms:    r.latencyMs,
    error:         r.error ?? null,
    checked_at:    r.checkedAt,
  }));

  const { error } = await supabase.from("uptime_checks").insert(rows);
  if (error) console.error("[UptimeMonitor] Failed to save results:", error.message);
}

/** Send alert email when sites are found to be down. */
export async function alertOnDownSites(downSites: UptimeResult[]) {
  if (downSites.length === 0) return;
  if (!process.env.RESEND_API_KEY || !process.env.RESULT_TO_EMAIL) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const rows = downSites.map(s =>
      `<tr>
        <td style="padding:8px 12px;color:#f87171;font-weight:600;">${s.businessName}</td>
        <td style="padding:8px 12px;color:#94a3b8;">${s.url}</td>
        <td style="padding:8px 12px;color:#f87171;">${s.status.toUpperCase()}</td>
        <td style="padding:8px 12px;color:#64748b;">${s.statusCode ?? s.error ?? "—"}</td>
      </tr>`
    ).join("");

    await resend.emails.send({
      from: "WebGecko Monitor <hello@webgecko.au>",
      to: process.env.RESULT_TO_EMAIL,
      subject: `⚠️ ${downSites.length} site${downSites.length > 1 ? "s" : ""} down — WebGecko Uptime Alert`,
      html: [
        "<!DOCTYPE html><html><body style='margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;'>",
        "<table width='100%' cellpadding='0' cellspacing='0' style='padding:40px 20px;'><tr><td align='center'>",
        "<table width='680' cellpadding='0' cellspacing='0' style='background:#0f1623;border-radius:12px;border:1px solid rgba(255,255,255,0.08);'>",
        "<tr><td style='background:linear-gradient(135deg,#ef4444,#b91c1c);padding:24px 32px;'>",
        `<h1 style='margin:0;color:#fff;font-size:20px;'>⚠️ ${downSites.length} Site${downSites.length > 1 ? "s" : ""} Down</h1>`,
        "</td></tr>",
        "<tr><td style='padding:24px 32px;'>",
        "<table style='width:100%;border-collapse:collapse;'>",
        "<thead><tr style='border-bottom:1px solid rgba(255,255,255,0.08);'>",
        "<th style='padding:8px 12px;text-align:left;color:#64748b;font-size:12px;'>Business</th>",
        "<th style='padding:8px 12px;text-align:left;color:#64748b;font-size:12px;'>URL</th>",
        "<th style='padding:8px 12px;text-align:left;color:#64748b;font-size:12px;'>Status</th>",
        "<th style='padding:8px 12px;text-align:left;color:#64748b;font-size:12px;'>Code / Error</th>",
        "</tr></thead><tbody>",
        rows,
        "</tbody></table>",
        `<p style='color:#475569;font-size:12px;margin:20px 0 0;'>Checked at ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })} AEST</p>`,
        "</td></tr></table>",
        "</td></tr></table></body></html>",
      ].join(""),
    });

    console.log(`[UptimeMonitor] Alert sent for ${downSites.length} down site(s)`);
  } catch (e) {
    console.error("[UptimeMonitor] Alert email failed:", e);
  }
}
