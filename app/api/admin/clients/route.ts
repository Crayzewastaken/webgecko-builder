// app/api/admin/clients/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.PROCESS_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: clientRows, error } = await supabase
    .from("clients")
    .select("*, jobs(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: bookingCounts } = await supabase
    .from("bookings")
    .select("job_id")
    .neq("status", "cancelled");

  const bookingsByJob: Record<string, number> = {};
  for (const b of bookingCounts || []) {
    bookingsByJob[b.job_id] = (bookingsByJob[b.job_id] || 0) + 1;
  }

  const { data: paymentRows } = await supabase
    .from("payment_state")
    .select("job_id, deposit_paid, final_paid");

  const paymentByJob: Record<string, { deposit_paid: boolean; final_paid: boolean }> = {};
  for (const p of paymentRows || []) {
    paymentByJob[p.job_id] = { deposit_paid: !!p.deposit_paid, final_paid: !!p.final_paid };
  }

  const clients = (clientRows || []).map((c: any) => {
    const job = c.jobs || {};
    const userInput = job.user_input || {};
    const ps = paymentByJob[c.job_id] || { deposit_paid: false, final_paid: false };
    return {
      slug: c.slug,
      jobId: c.job_id || "",
      businessName: c.business_name || userInput.businessName || c.slug,
      industry: c.industry || userInput.industry || "",
      previewUrl: c.preview_url || job.preview_url || "",
      buildStatus: job.status || "pending",
      hasBooking: job.has_booking || false,
      builtAt: job.created_at || c.created_at || null,
      domain: c.domain || userInput.domain || "",
      liveDomain: userInput.domain || "",
      liveUrl: c.preview_url || job.preview_url || "",
      vercelProjectName: job.vercel_project_name || "",
      paymentState: {
        depositPaid: ps.deposit_paid,
        finalPaid: ps.final_paid,
        monthlyActive: !!c.square_subscription_id,
      },
      bookingCount: bookingsByJob[c.job_id] || 0,
      supersaasId: job.supersaas_id || "",
      supersaasUrl: job.supersaas_url || "",
      bookingServices: userInput.bookingServices || "",
      clientEmail: userInput.email || c.email || "",
      clientPhone: userInput.phone || c.phone || "",
      metadata: job.metadata || null,
    };
  });

  return Response.json({ clients });
}
