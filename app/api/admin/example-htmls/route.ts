// app/api/admin/example-htmls/route.ts
// Upload/list/delete example HTML files used as reference context during builds.
// Stored in Supabase Storage bucket "example-htmls".
// Files can be global (industry-tagged) or per-client (jobId-tagged).
// Filename format: "job__<jobId>__<label>__<ts>.html" or "<industry>__<label>__<ts>.html"

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const BUCKET = "example-htmls";

export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const jobId = new URL(req.url).searchParams.get("jobId");

  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let files = (data || []).map(f => ({
    name: f.name,
    size: f.metadata?.size || 0,
    createdAt: f.created_at,
    isClientFile: f.name.startsWith("job__"),
    jobId: f.name.startsWith("job__") ? f.name.split("__")[1] : null,
    industry: f.name.startsWith("job__") ? null : f.name.split("__")[0],
    label: f.name.startsWith("job__")
      ? (f.name.split("__")[2] || f.name).replace(/\.html?$/i, "")
      : (f.name.split("__")[1] || f.name).replace(/\.html?$/i, ""),
  }));

  // If jobId provided, return only files for that client
  if (jobId) files = files.filter(f => f.jobId === jobId);

  return Response.json({ files });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const jobId = (formData.get("jobId") as string) || "";
  const label = ((formData.get("label") as string) || "example").toLowerCase().replace(/[^a-z0-9-]/g, "-");

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.match(/\.html?$/i)) return Response.json({ error: "Only .html files accepted" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ error: "File too large (max 2MB)" }, { status: 400 });

  const fileName = jobId
    ? `job__${jobId}__${label}__${Date.now()}.html`
    : `general__${label}__${Date.now()}.html`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType: "text/html", upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, fileName });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await req.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const { error } = await supabase.storage.from(BUCKET).remove([name]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
