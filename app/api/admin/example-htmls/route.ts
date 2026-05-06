// app/api/admin/example-htmls/route.ts
// Upload/list/delete example HTML files used as reference context during builds.
// Stored in Supabase Storage bucket "example-htmls".
// Tagged with industry + label so Claude can pull relevant examples per build.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const BUCKET = "example-htmls";

// ── GET — list all example files ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const files = (data || []).map(f => ({
    name: f.name,
    size: f.metadata?.size || 0,
    createdAt: f.created_at,
    // Parse industry + label from filename: "industry__label.html"
    industry: f.name.split("__")[0] || "general",
    label: (f.name.split("__")[1] || f.name).replace(/\.html?$/i, ""),
    url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
  }));

  return Response.json({ files });
}

// ── POST — upload a new example HTML file ─────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const industry = ((formData.get("industry") as string) || "general").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const label = ((formData.get("label") as string) || "example").toLowerCase().replace(/[^a-z0-9-]/g, "-");

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.match(/\.html?$/i)) return Response.json({ error: "Only .html files accepted" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ error: "File too large (max 2MB)" }, { status: 400 });

  const fileName = `${industry}__${label}__${Date.now()}.html`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: "text/html",
    upsert: false,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, fileName });
}

// ── DELETE — remove an example file ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const { error } = await supabase.storage.from(BUCKET).remove([name]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
