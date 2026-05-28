// app/api/admin/upload-social-image/route.ts
// Upload a social media image from the admin panel to Supabase storage.
// Returns a public URL that can be attached to a Postiz post.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const BUCKET = "social-uploads";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.size) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "File too large (max 20MB)" }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });

  if (upErr) {
    console.error("[upload-social-image] Storage error:", upErr.message);
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!urlData?.publicUrl) {
    return Response.json({ error: "Failed to get public URL" }, { status: 500 });
  }

  return Response.json({ ok: true, url: urlData.publicUrl });
}
