// lib/db.ts
// Database helpers — Supabase replacements for Redis calls
// Drop-in replacements so migration can be done file by file

import { supabase } from "./supabase";
import { encryptPayload, decryptPayload } from "./encryption";


// ============================================================
// JOBS
// ============================================================

export async function getJob(jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error) return null;
  return dbJobToJob(data);
}

export async function saveJob(jobId: string, job: Record<string, any>) {
  const row = jobToDbJob(jobId, job);
  const { error } = await supabase
    .from("jobs")
    .upsert(row, { onConflict: "id" });
  if (error) throw new Error(`saveJob failed: ${error.message}`);
}

export async function listJobs(limit = 50) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map(dbJobToJob);
}

export async function appendPipelineLog(
  jobId: string,
  entry: { level: "info" | "warn" | "error"; step: string; msg: string; businessName?: string }
) {
  // Write to the dedicated pipeline_logs table — O(1) INSERT, no read-modify-write.
  // Falls back silently to the legacy metadata blob if the table doesn't exist yet
  // (so deploys before the migration runs don't crash).
  try {
    const { error } = await supabase.from("pipeline_logs").insert({
      job_id:        jobId,
      level:         entry.level,
      step:          entry.step,
      msg:           entry.msg,
      business_name: entry.businessName ?? null,
      ts:            new Date().toISOString(),
    });
    if (error) {
      // Table may not exist yet — fall back to legacy metadata append
      if (error.code === "42P01") {
        await _legacyAppendPipelineLog(jobId, entry);
      } else {
        console.warn("[appendPipelineLog] Insert failed:", error.message);
      }
    }
  } catch { /* non-fatal */ }
}

// Legacy fallback: read-modify-write on jobs.metadata.logs.
// Only used while the pipeline_logs table migration is pending.
async function _legacyAppendPipelineLog(
  jobId: string,
  entry: { level: "info" | "warn" | "error"; step: string; msg: string; businessName?: string }
) {
  try {
    const { data } = await supabase.from("jobs").select("metadata").eq("id", jobId).single();
    const meta = data?.metadata || {};
    const logs = [...((meta.logs || []) as any[]).slice(-199), { ts: new Date().toISOString(), jobId, ...entry }];
    await supabase.from("jobs").update({ metadata: { ...meta, logs } }).eq("id", jobId);
  } catch { /* non-fatal */ }
}

export async function getPipelineLogs(limit = 300) {
  // Try new pipeline_logs table first; fall back to legacy metadata scan.
  try {
    const { data, error } = await supabase
      .from("pipeline_logs")
      .select("job_id, level, step, msg, business_name, ts")
      .order("ts", { ascending: false })
      .limit(limit);

    if (!error && data) {
      return data.map((r: any) => ({
        jobId:        r.job_id,
        level:        r.level,
        step:         r.step,
        msg:          r.msg,
        businessName: r.business_name ?? r.job_id,
        ts:           r.ts,
      }));
    }
    // Table not yet created — fall through to legacy path
    if (error?.code !== "42P01") throw error;
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("[getPipelineLogs] Unexpected error:", e);
  }

  // ── Legacy path: scan jobs.metadata.logs ─────────────────────────────────
  const { data } = await supabase
    .from("jobs")
    .select("id, status, created_at, metadata, user_input")
    .order("created_at", { ascending: false })
    .limit(150);
  const entries: any[] = [];
  for (const row of data || []) {
    const logs: any[] = row.metadata?.logs || [];
    const name = row.user_input?.businessName || row.id;
    for (const l of logs) {
      entries.push({ ...l, businessName: l.businessName || name, jobId: l.jobId || row.id });
    }
    if (row.status === "failed" && !logs.some((l: any) => l.level === "error")) {
      entries.push({
        level: "error", step: "pipeline",
        msg: "Build failed (no error detail recorded — check Inngest dashboard)",
        businessName: name, jobId: row.id,
        ts: row.created_at || new Date().toISOString(),
      });
    }
  }
  return entries.sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, limit);
}

// ============================================================
// CLIENTS
// ============================================================

export async function getClient(slug: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function saveClient(slug: string, client: Record<string, any>) {
  const { error } = await supabase
    .from("clients")
    .upsert({ slug, ...client }, { onConflict: "slug" });
  if (error) throw new Error(`saveClient failed: ${error.message}`);
}

// ============================================================
// AVAILABILITY
// ============================================================

export async function getAvailability(jobId: string) {
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("job_id", jobId)
    .single();
  if (error) return null;
  return data ? dbAvailToAvail(data) : null;
}

export async function saveAvailability(jobId: string, config: Record<string, any>) {
  const { error } = await supabase
    .from("availability")
    .upsert({
      job_id: jobId,
      business_name: config.businessName,
      client_email: config.clientEmail,
      timezone: config.timezone || "Australia/Brisbane",
      days: config.days || [1, 2, 3, 4, 5],
      start_hour: config.startHour ?? 9,
      end_hour: config.endHour ?? 17,
      slot_duration_minutes: config.slotDurationMinutes ?? 60,
      buffer_minutes: config.bufferMinutes ?? 15,
      max_days_ahead: config.maxDaysAhead ?? 30,
      services: config.services || [],
    }, { onConflict: "job_id" });
  if (error) throw new Error(`saveAvailability failed: ${error.message}`);
}

// ============================================================
// BOOKINGS
// ============================================================

export async function getBookingsForJob(jobId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("job_id", jobId)
    .order("slot_start", { ascending: true });
  if (error) return [];
  return data || [];
}

export async function saveBooking(booking: {
  jobId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  service: string;
  slotStart: string;
  slotEnd: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      job_id: booking.jobId,
      customer_name: booking.customerName,
      customer_email: booking.customerEmail,
      customer_phone: booking.customerPhone || "",
      service: booking.service,
      slot_start: booking.slotStart,
      slot_end: booking.slotEnd,
      notes: booking.notes || "",
      status: "confirmed",
    })
    .select()
    .single();
  if (error) throw new Error(`saveBooking failed: ${error.message}`);
  return data;
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);
  if (error) throw new Error(`cancelBooking failed: ${error.message}`);
}

// ============================================================
// PAYMENTS
// ============================================================

export async function savePayment(payment: Record<string, any>) {
  const { error } = await supabase
    .from("payments")
    .upsert({
      id: payment.id,
      job_id: payment.jobId,
      client_slug: payment.clientSlug,
      amount_cents: payment.amountCents,
      currency: payment.currency || "AUD",
      status: payment.status,
      square_payment_id: payment.squarePaymentId,
      square_order_id: payment.squareOrderId,
    }, { onConflict: "id" });
  if (error) throw new Error(`savePayment failed: ${error.message}`);
}

// ============================================================
// FEEDBACK
// ============================================================

export async function saveFeedback(jobId: string, feedback: { rating?: number; message?: string; clientSlug?: string }) {
  const { error } = await supabase
    .from("feedback")
    .insert({
      job_id: jobId,
      client_slug: feedback.clientSlug,
      rating: feedback.rating,
      message: feedback.message,
    });
  if (error) throw new Error(`saveFeedback failed: ${error.message}`);
}

// ============================================================
// ANALYTICS
// ============================================================

export async function trackAnalyticsEvent(jobId: string, event: string, page?: string) {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const month = date.slice(0, 7);
  const { error } = await supabase.from("analytics").insert({ job_id: jobId, event, page: page || null, date, month });
  if (error) console.error("trackAnalyticsEvent failed:", error.message);
}

export async function getAnalyticsCount(jobId: string, event: string, period: "daily" | "monthly" | "total", value?: string): Promise<number> {
  let query = supabase.from("analytics").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("event", event);
  if (period === "daily" && value) query = query.eq("date", value);
  if (period === "monthly" && value) query = query.eq("month", value);
  const { count } = await query;
  return count || 0;
}

// Batch analytics summary — replaces 7 individual getAnalyticsCount calls with a single
// Postgres RPC that returns all counts in one round-trip.
// Falls back to parallel individual queries if the RPC isn't deployed yet.
export async function getAnalyticsSummary(jobId: string, today: string, month: string) {
  try {
    const { data, error } = await supabase.rpc("get_analytics_summary", { p_job_id: jobId, p_today: today, p_month: month });
    if (!error && data) return data as {
      month_views: number; month_booking_clicks: number; month_contact_clicks: number;
      today_views: number; today_booking_clicks: number;
      total_views: number; total_booking_clicks: number;
    };
  } catch { /* rpc not yet deployed — fall through */ }

  // Fallback: parallel individual queries
  const [mv, mb, mc, tv, tb, totV, totB] = await Promise.all([
    getAnalyticsCount(jobId, "page_view",      "monthly", month),
    getAnalyticsCount(jobId, "booking_click",  "monthly", month),
    getAnalyticsCount(jobId, "contact_click",  "monthly", month),
    getAnalyticsCount(jobId, "page_view",      "daily",   today),
    getAnalyticsCount(jobId, "booking_click",  "daily",   today),
    getAnalyticsCount(jobId, "page_view",      "total"),
    getAnalyticsCount(jobId, "booking_click",  "total"),
  ]);
  return {
    month_views: mv, month_booking_clicks: mb, month_contact_clicks: mc,
    today_views: tv, today_booking_clicks: tb,
    total_views: totV, total_booking_clicks: totB,
  };
}

export async function getTopPages(jobId: string, limit = 5): Promise<{ page: string; views: number }[]> {
  try {
    const { data, error } = await supabase
      .from("page_analytics_summary")
      .select("page, views")
      .eq("job_id", jobId)
      .order("views", { ascending: false })
      .limit(limit);

    if (error || !data) {
      throw error || new Error("No data returned from view");
    }

    return data.map((row: any) => ({ page: row.page, views: Number(row.views) }));
  } catch (e) {
    console.warn("[Analytics View Fallback] Failed to fetch from page_analytics_summary view, falling back to in-memory counting:", e);
    // LIMIT the fallback scan to the most recent 10,000 rows — no full table scans.
    const { data } = await supabase
      .from("analytics")
      .select("page")
      .eq("job_id", jobId)
      .eq("event", "page_view")
      .not("page", "is", null)
      .order("id", { ascending: false })
      .limit(10000);
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const row of data) { if (row.page) counts[row.page] = (counts[row.page] || 0) + 1; }
    return Object.entries(counts).map(([page, views]) => ({ page, views })).sort((a, b) => b.views - a.views).slice(0, limit);
  }
}


// ============================================================
// PAYMENT STATE
// ============================================================

export async function getPaymentState(jobId: string) {
  const { data } = await supabase.from("payment_state").select("*").eq("job_id", jobId).single();
  return data || null;
}

export async function savePaymentState(jobId: string, state: Record<string, any>) {
  const { error } = await supabase.from("payment_state").upsert({
    job_id: jobId,
    deposit_paid: state.depositPaid ?? state.deposit_paid ?? false,
    final_unlocked: state.finalUnlocked ?? state.final_unlocked ?? false,
    final_paid: state.finalPaid ?? state.final_paid ?? false,
    monthly_active: state.monthlyActive ?? state.monthly_active ?? false,
    preview_unlocked: state.previewUnlocked ?? state.preview_unlocked ?? false,
    preview_unlocked_at: state.previewUnlockedAt ?? state.preview_unlocked_at ?? null,
    final_unlocked_at: state.finalUnlockedAt ?? state.final_unlocked_at ?? null,
    square_subscription_id: state.squareSubscriptionId ?? state.square_subscription_id ?? null,
    payments: state.payments || {},
  }, { onConflict: "job_id" });
  if (error) throw new Error(`savePaymentState failed: ${error.message}`);
}

// ============================================================
// Token Encryption / Decryption Helpers (sniffing for backwards compatibility)
// ============================================================

function encryptToken(token: string | null): string | null {
  if (!token) return null;
  if (token.startsWith('{"encrypted":')) return token;
  try {
    const encryptedObj = encryptPayload(token);
    return JSON.stringify(encryptedObj);
  } catch (e) {
    console.error("[Token Encryption] Failed to encrypt token:", e);
    return token;
  }
}

function decryptToken(tokenValue: string | null): string | null {
  if (!tokenValue) return null;
  if (!tokenValue.startsWith('{"encrypted":')) {
    return tokenValue;
  }
  try {
    const parsed = JSON.parse(tokenValue);
    if (parsed && parsed.encrypted && parsed.iv && parsed.tag) {
      return decryptPayload(parsed.encrypted, parsed.iv, parsed.tag, parsed.v);
    }
  } catch (e) {
    console.error("[Token Decryption] Failed to decrypt token:", e);
  }
  return tokenValue;
}

// ============================================================
// Shape converters (Redis stored camelCase, Supabase uses snake_case)
// ============================================================

function jobToDbJob(id: string, job: Record<string, any>) {
  return {
    id,
    status: job.status || "pending",
    html: job.html || null,
    preview_url: job.previewUrl || null,
    vercel_project_name: job.vercelProjectName || null,
    domain_slug: job.domainSlug || null,
    client_slug: job.clientSlug || null,
    ga4_id: job.ga4Id || null,
    logo_url: job.logoUrl || null,
    hero_url: job.heroUrl || null,
    photo_urls: job.photoUrls || [],
    products_with_photos: job.productsWithPhotos || [],
    has_booking: job.hasBooking || false,
    user_input: job.userInput || null,
    fixed_at: job.fixedAt || null,
    // SuperSaas — stored on jobs table
    supersaas_url: job.supersaasUrl || null,
    supersaas_id: job.supersaasId || null,
    // Tawk.to
    tawkto_property_id: job.tawktoPropertyId || null,
    // Square per-client OAuth credentials
    ...(job.squareAccessToken !== undefined ? { square_access_token: encryptToken(job.squareAccessToken) } : {}),
    ...(job.squareRefreshToken !== undefined ? { square_refresh_token: encryptToken(job.squareRefreshToken) } : {}),
    ...(job.squareTokenExpiresAt !== undefined ? { square_token_expires_at: job.squareTokenExpiresAt } : {}),
    ...(job.squareMerchantId !== undefined ? { square_merchant_id: job.squareMerchantId } : {}),
    ...(job.squareLocationId !== undefined ? { square_location_id: job.squareLocationId } : {}),
    // Stripe Connect per-client credentials
    ...(job.stripeAccountId !== undefined ? { stripe_account_id: job.stripeAccountId } : {}),
    ...(job.stripeAccessToken !== undefined ? { stripe_access_token: encryptToken(job.stripeAccessToken) } : {}),
    ...(job.stripeRefreshToken !== undefined ? { stripe_refresh_token: encryptToken(job.stripeRefreshToken) } : {}),
    ...(job.stripeConnectedAt !== undefined ? { stripe_connected_at: job.stripeConnectedAt } : {}),
    // Shop catalogue
    ...(job.shopCatalogue !== undefined ? { shop_catalogue: job.shopCatalogue } : {}),
    ...(job.shopSyncedAt !== undefined ? { shop_synced_at: job.shopSyncedAt } : {}),
    ...(job.shopPlatform !== undefined ? { shop_platform: job.shopPlatform } : {}),
    // Metadata jsonb — stores sub-user creds, extra intake fields, etc.
    metadata: {
      ...(job.metadata || {}),
      ...(job.builtAt ? { builtAt: job.builtAt } : {}),
      ...(job.customHeadHtml !== undefined ? { customHeadHtml: job.customHeadHtml } : {}),
      ...(job.customBodyHtml !== undefined ? { customBodyHtml: job.customBodyHtml } : {}),
    },
  };
}

function dbJobToJob(row: Record<string, any>) {
  return {
    id: row.id,
    status: row.status,
    html: row.html,
    previewUrl: row.preview_url,
    vercelProjectName: row.vercel_project_name,
    domainSlug: row.domain_slug,
    clientSlug: row.client_slug,
    ga4Id: row.ga4_id,
    logoUrl: row.logo_url,
    heroUrl: row.hero_url,
    photoUrls: row.photo_urls || [],
    productsWithPhotos: row.products_with_photos || [],
    hasBooking: row.has_booking,
    userInput: row.user_input,
    fixedAt: row.fixed_at,
    builtAt: row.metadata?.builtAt || row.fixed_at || null,
    createdAt: row.created_at,
    supersaasUrl: row.supersaas_url,
    supersaasId: row.supersaas_id,
    tawktoPropertyId: row.tawkto_property_id,
    squareAccessToken: decryptToken(row.square_access_token) || null,
    squareRefreshToken: decryptToken(row.square_refresh_token) || null,
    squareTokenExpiresAt: row.square_token_expires_at || null,
    squareMerchantId: row.square_merchant_id || null,
    squareLocationId: row.square_location_id || null,
    stripeAccountId: row.stripe_account_id || null,
    stripeAccessToken: decryptToken(row.stripe_access_token) || null,
    stripeRefreshToken: decryptToken(row.stripe_refresh_token) || null,
    stripeConnectedAt: row.stripe_connected_at || null,
    shopCatalogue: row.shop_catalogue || null,
    shopSyncedAt: row.shop_synced_at || null,
    shopPlatform: row.shop_platform || null,
    slug: row.client_slug || row.domain_slug || null,
    liveUrl: row.metadata?.liveUrl || row.preview_url || null,
    businessName: row.user_input?.businessName || null,
    metadata: row.metadata || null,
    customHeadHtml: row.metadata?.customHeadHtml || null,
    customBodyHtml: row.metadata?.customBodyHtml || null,
  };
}


function dbAvailToAvail(row: Record<string, any>) {
  return {
    jobId: row.job_id,
    businessName: row.business_name,
    clientEmail: row.client_email,
    timezone: row.timezone,
    days: row.days,
    startHour: row.start_hour,
    endHour: row.end_hour,
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
    maxDaysAhead: row.max_days_ahead,
    services: row.services || [],
  };
}
