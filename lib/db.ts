// lib/db.ts
// Database helpers — Supabase replacements for Redis calls
// Drop-in replacements so migration can be done file by file

import { supabase } from "./supabase";

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

export async function getTopPages(jobId: string, limit = 5): Promise<{ page: string; views: number }[]> {
  const { data } = await supabase
    .from("analytics")
    .select("page")
    .eq("job_id", jobId)
    .eq("event", "page_view")
    .not("page", "is", null);
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const row of data) { if (row.page) counts[row.page] = (counts[row.page] || 0) + 1; }
  return Object.entries(counts).map(([page, views]) => ({ page, views })).sort((a, b) => b.views - a.views).slice(0, limit);
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
    ...(job.squareAccessToken !== undefined ? { square_access_token: job.squareAccessToken } : {}),
    ...(job.squareRefreshToken !== undefined ? { square_refresh_token: job.squareRefreshToken } : {}),
    ...(job.squareTokenExpiresAt !== undefined ? { square_token_expires_at: job.squareTokenExpiresAt } : {}),
    ...(job.squareMerchantId !== undefined ? { square_merchant_id: job.squareMerchantId } : {}),
    ...(job.squareLocationId !== undefined ? { square_location_id: job.squareLocationId } : {}),
    // Metadata jsonb — stores sub-user creds, extra intake fields, etc.
    ...(job.metadata !== undefined ? { metadata: job.metadata } : {}),
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
    createdAt: row.created_at,
    supersaasUrl: row.supersaas_url,
    supersaasId: row.supersaas_id,
    tawktoPropertyId: row.tawkto_property_id,
    squareAccessToken: row.square_access_token || null,
    squareRefreshToken: row.square_refresh_token || null,
    squareTokenExpiresAt: row.square_token_expires_at || null,
    squareMerchantId: row.square_merchant_id || null,
    squareLocationId: row.square_location_id || null,
    metadata: row.metadata || null,
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
