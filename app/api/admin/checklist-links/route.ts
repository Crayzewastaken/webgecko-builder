// app/api/admin/checklist-links/route.ts
// GET  ?jobId=xxx  — fetch saved checklist link URLs for a job
// POST { jobId, links }  — save checklist link URLs

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export const runtime = "nodejs";

function auth(req: NextRequest) { return isAdminAuthedLegacy(req); }

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const { data } = await supabase
    .from("jobs")
    .select("metadata")
    .eq("id", jobId)
    .single();

  const links = data?.metadata?.checklistLinks || {};
  return NextResponse.json({ ok: true, links });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { jobId?: string; links?: Record<string, string> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const { jobId, links } = body;
  if (!jobId || !links) return NextResponse.json({ error: "Missing jobId or links" }, { status: 400 });

  // Read current metadata, merge links in
  const { data: existing } = await supabase.from("jobs").select("metadata").eq("id", jobId).single();
  const merged = { ...(existing?.metadata || {}), checklistLinks: links };

  const { error } = await supabase.from("jobs").update({ metadata: merged }).eq("id", jobId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the Termly privacy URL was just saved, patch it into the stored site HTML
  const termlyUrl = links["termly_privacy_embed"];
  if (termlyUrl && termlyUrl.startsWith("http")) {
    const { data: jobRow } = await supabase.from("jobs").select("html").eq("id", jobId).single();
    const rawHtml: string = jobRow?.html || "";
    if (rawHtml) {
      // Replace placeholder privacy href in data-wg-privacy links
      const patched = rawHtml.replace(
        /(<a[^>]*data-wg-privacy[^>]*href=")[^"]*"/g,
        (_m: string, pre: string) => pre + termlyUrl + '"'
      );
      if (patched !== rawHtml) {
        await supabase.from("jobs").update({ html: patched }).eq("id", jobId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
