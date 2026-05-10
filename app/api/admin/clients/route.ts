// app/api/admin/clients/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // All queries in parallel for speed
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const [
    { data: clientRows, error },
    { data: bookingCounts },
    { data: paymentRows },
    { data: analyticsRows },
  ] = await Promise.all([
    supabase.from("clients").select("*, jobs(*)").order("created_at", { ascending: false }),
    supabase.from("bookings").select("job_id").neq("status", "cancelled"),
    supabase.from("payment_state").select("job_id, deposit_paid, final_paid, monthly_active, square_subscription_id"),
    // Single bulk fetch — aggregate in JS, no N+1 queries
    supabase.from("analytics").select("job_id, event, date, month"),
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Index: bookings per job
  const bookingsByJob: Record<string, number> = {};
  for (const b of bookingCounts || []) {
    bookingsByJob[b.job_id] = (bookingsByJob[b.job_id] || 0) + 1;
  }

  // Index: payment state per job
  // monthly_active lives in payment_state; square_subscription_id is a secondary signal on the clients row
  type PaymentState = { deposit_paid: boolean; final_paid: boolean; monthly_active: boolean; square_subscription_id: string | null };
  const paymentByJob: Record<string, PaymentState> = {};
  for (const p of paymentRows || []) {
    paymentByJob[p.job_id] = {
      deposit_paid: !!p.deposit_paid,
      final_paid: !!p.final_paid,
      monthly_active: !!p.monthly_active,
      square_subscription_id: p.square_subscription_id || null,
    };
  }

  // Index: analytics aggregated per job — single pass, no extra queries
  type AnalyticsAgg = {
    todayViews: number; todayBookingClicks: number;
    monthViews: number; monthBookingClicks: number; monthContactClicks: number;
    totalViews: number; totalBookingClicks: number; totalFormSubmits: number;
  };
  const analyticsByJob: Record<string, AnalyticsAgg> = {};

  const blankAgg = (): AnalyticsAgg => ({
    todayViews: 0, todayBookingClicks: 0,
    monthViews: 0, monthBookingClicks: 0, monthContactClicks: 0,
    totalViews: 0, totalBookingClicks: 0, totalFormSubmits: 0,
  });

  for (const row of analyticsRows || []) {
    if (!row.job_id) continue;
    if (!analyticsByJob[row.job_id]) analyticsByJob[row.job_id] = blankAgg();
    const a = analyticsByJob[row.job_id];
    const isToday = row.date === today;
    const isThisMonth = row.month === thisMonth;

    if (row.event === "page_view") {
      a.totalViews++;
      if (isThisMonth) a.monthViews++;
      if (isToday) a.todayViews++;
    } else if (row.event === "booking_click") {
      a.totalBookingClicks++;
      if (isThisMonth) a.monthBookingClicks++;
      if (isToday) a.todayBookingClicks++;
    } else if (row.event === "contact_click") {
      if (isThisMonth) a.monthContactClicks++;
    } else if (row.event === "form_submit") {
      a.totalFormSubmits++;
    }
  }

  // Build client list
  const clients = (clientRows || []).map((c: any) => {
    const job = c.jobs || {};
    const userInput = job.user_input || {};
    const blankPs: PaymentState = { deposit_paid: false, final_paid: false, monthly_active: false, square_subscription_id: null };
    const ps = paymentByJob[c.job_id] || blankPs;
    const a = analyticsByJob[c.job_id] || blankAgg();

    return {
      slug: c.slug,
      jobId: c.job_id || "",
      businessName: c.business_name || userInput.businessName || c.slug,
      industry: c.industry || userInput.industry || "",
      previewUrl: c.preview_url || job.preview_url || "",
      buildStatus: job.status || "pending",
      hasBooking: job.has_booking || false,
      builtAt: job.metadata?.builtAt || job.fixed_at || job.created_at || c.created_at || null,
      domain: c.domain || userInput.domain || "",
      liveDomain: userInput.domain || "",
      liveUrl: c.preview_url || job.preview_url || "",
      vercelProjectName: job.vercel_project_name || "",
      paymentState: {
        depositPaid: ps.deposit_paid,
        finalPaid: ps.final_paid,
        monthlyActive: ps.monthly_active || !!ps.square_subscription_id || !!c.square_subscription_id,
      },
      analytics: {
        today: {
          views: a.todayViews,
          bookingClicks: a.todayBookingClicks,
        },
        thisMonth: {
          views: a.monthViews,
          bookingClicks: a.monthBookingClicks,
          contactClicks: a.monthContactClicks,
        },
        totals: {
          views: a.totalViews,
          bookingClicks: a.totalBookingClicks,
          formSubmits: a.totalFormSubmits,
        },
      },
      bookingCount: bookingsByJob[c.job_id] || 0,
      supersaasId: job.supersaas_id || "",
      supersaasUrl: job.supersaas_url || (job.supersaasId ? `https://www.supersaas.com/schedule/${job.supersaas_account_name || ""}/${job.supersaas_id}` : ""),
      bookingServices: userInput.bookingServices || "",
      clientEmail: userInput.email || c.email || "",
      clientPhone: userInput.phone || c.phone || "",
      metadata: job.metadata || null,
      userInput: {
        features: userInput.features || [],
        pages: userInput.pages || [],
        siteType: userInput.siteType || "single",
        style: userInput.style || "",
        colorPrefs: userInput.colorPrefs || "",
        usp: userInput.usp || "",
        goal: userInput.goal || "",
        additionalNotes: userInput.additionalNotes || "",
        abn: userInput.abn || "",
        businessAddress: userInput.businessAddress || "",
        facebookPage: userInput.facebookPage || "",
        instagramUrl: userInput.instagramUrl || "",
        linkedinUrl: userInput.linkedinUrl || "",
      },
      shopCatalogue: userInput.shopCatalogue || null,
      tawktoPropertyId: job.tawkto_property_id || job.tawktoPropertyId || "",
      logoUrl: job.logo_url || "",
      heroUrl: job.hero_url || "",
      photoUrls: job.photo_urls || [],
      squareAccessToken: job.square_access_token || "",
      squareLocationId: job.square_location_id || "",
      ga4Id: job.ga4_id || job.ga4Id || "",
    };
  });

  return Response.json({ clients });
}
