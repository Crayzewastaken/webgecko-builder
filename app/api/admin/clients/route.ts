// app/api/admin/clients/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.PROCESS_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all clients joined with jobs
  const { data: clientRows, error } = await supabase
    .from("clients")
    .select("*, jobs(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Get booking counts per job
  const { data: bookingCounts } = await supabase
    .from("bookings")
    .select("job_id")
    .neq("status", "cancelled");

  const bookingsByJob: Record<string, number> = {};
  for (const b of bookingCounts || []) {
    bookingsByJob[b.job_id] = (bookingsByJob[b.job_id] || 0) + 1;
  }

  const clients = (clientRows || []).map((c: any) => {
    const job = c.jobs || {};
    const userInput = job.user_input || {};
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
        depositPaid: false,
        finalPaid: false,
        monthlyActive: !!c.square_subscription_id,
      },
      bookingCount: bookingsByJob[c.job_id] || 0,
      metadata: job.metadata || null,
    };
  });

  return Response.json({ clients });
}
