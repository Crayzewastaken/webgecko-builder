// app/api/versions/html/route.ts
// GET /api/versions/html?id=xxx
// Returns just the html field for a single version (for preview iframe)

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("page_versions")
    .select("id, label, html, created_at")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id: data.id, label: data.label, html: data.html, created_at: data.created_at });
}
