// app/api/admin/delete-client/route.ts
// Permanently deletes a client and all their associated data from Supabase.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!jobId && !slug) {
    return NextResponse.json({ error: "jobId or slug required" }, { status: 400 });
  }

  try {
    const deleted: string[] = [];

    if (jobId) {
      // Delete bookings
      await supabase.from("bookings").delete().eq("job_id", jobId);
      deleted.push(`bookings for ${jobId}`);

      // Delete availability
      await supabase.from("availability").delete().eq("job_id", jobId);
      deleted.push(`availability:${jobId}`);

      // Delete payments
      await supabase.from("payments").delete().eq("job_id", jobId);
      deleted.push(`payments for ${jobId}`);

      // Delete feedback
      await supabase.from("feedback").delete().eq("job_id", jobId);
      deleted.push(`feedback for ${jobId}`);

      // Delete client linked to job
      await supabase.from("clients").delete().eq("job_id", jobId);
      deleted.push(`client for job ${jobId}`);

      // Delete job
      await supabase.from("jobs").delete().eq("id", jobId);
      deleted.push(`job:${jobId}`);
    }

    if (slug && !jobId) {
      await supabase.from("clients").delete().eq("slug", slug);
      deleted.push(`client:${slug}`);
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("Delete client error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
