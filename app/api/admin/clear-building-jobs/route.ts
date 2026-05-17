// app/api/admin/clear-building-jobs/route.ts
// Resets all jobs stuck in "building" status back to "completed".
// Useful when Inngest runs get cancelled mid-flight and leave orphaned building state.
import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: stuckJobs, error } = await supabase
    .from("jobs")
    .select("id, user_input")
    .eq("status", "building");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!stuckJobs || stuckJobs.length === 0) return Response.json({ cleared: 0, message: "No building jobs found" });

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ status: "completed" })
    .eq("status", "building");

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  console.log(`[ClearBuildingJobs] Reset ${stuckJobs.length} stuck building job(s)`);
  return Response.json({ cleared: stuckJobs.length, message: `Reset ${stuckJobs.length} building job(s) to completed` });
}
