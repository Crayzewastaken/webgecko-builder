// app/api/admin/upload-assets/route.ts
// Upload gallery photos, logo, or hero image for a client job.
// Stores in Supabase storage bucket "client-assets" and updates the job record.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const BUCKET = "client-assets";

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const jobId = formData.get("jobId") as string | null;
  const type = (formData.get("type") as string) || "gallery"; // "gallery" | "logo" | "hero"
  const files = formData.getAll("photos") as File[];

  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  if (!files.length) return Response.json({ error: "No files provided" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) continue; // skip >10MB
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET).upload(safeName, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.error("[upload-assets] storage error:", error.message);
      continue;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(safeName);
    if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
  }

  if (!uploadedUrls.length) {
    return Response.json({ error: "All uploads failed" }, { status: 500 });
  }

  // Update job record
  let updatedJob = { ...job };
  if (type === "logo") {
    updatedJob.logoUrl = uploadedUrls[0];
  } else if (type === "hero") {
    updatedJob.heroUrl = uploadedUrls[0];
  } else {
    // gallery — append to existing photoUrls
    const existing: string[] = Array.isArray(job.photoUrls) ? job.photoUrls : [];
    updatedJob.photoUrls = [...existing, ...uploadedUrls];
  }

  await saveJob(jobId, updatedJob);

  return Response.json({ ok: true, urls: uploadedUrls, count: uploadedUrls.length });
}
