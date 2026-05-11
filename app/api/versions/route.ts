// app/api/versions/route.ts
// GET /api/versions?jobId=xxx
// Auth: x-process-secret header
// Returns all snapshots for a job, newest first, without the full HTML body (for list view)

// DELETE /api/versions?id=xxx
// Deletes a single version by its UUID

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  // Fetch all versions for this job, excluding the html column for the list (too large)
  const { data, error } = await supabase
    .from("page_versions")
    .select("id, job_id, created_at, label, trigger, job_config, logs, screenshot_url")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, versions: data || [] });
}

export async function DELETE(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("page_versions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
