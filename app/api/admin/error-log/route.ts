import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, step, type, message, fixed = false } = body;
  if (!jobId || !step || !type || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const entry = {
    job_id: jobId,
    step,
    type,
    message,
    fixed,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pipeline_errors").insert(entry);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("pipeline_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("pipeline_errors").update({ fixed: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
