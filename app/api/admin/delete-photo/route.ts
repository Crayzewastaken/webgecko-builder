// app/api/admin/delete-photo/route.ts
// Remove a single photo from a job's photoUrls array and delete from Supabase storage.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const BUCKET = "client-assets";
// Public URL prefix used by Supabase for this bucket
const PUBLIC_URL_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId, photoUrl } = await req.json();
  if (!jobId || !photoUrl) {
    return Response.json({ error: "jobId and photoUrl required" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  // Extract the storage path from the public URL
  // e.g. https://<project>.supabase.co/storage/v1/object/public/client-assets/job_xxx/gallery/file.jpg
  // → job_xxx/gallery/file.jpg
  const idx = photoUrl.indexOf(PUBLIC_URL_PREFIX);
  if (idx !== -1) {
    const storagePath = photoUrl.slice(idx + PUBLIC_URL_PREFIX.length);
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      // Log but don't fail — we still remove from the job record
      console.error("[delete-photo] storage remove error:", error.message);
    }
  }

  // Remove from photoUrls array
  const existing: string[] = Array.isArray(job.photoUrls) ? job.photoUrls : [];
  const updated = existing.filter((u: string) => u !== photoUrl);
  await saveJob(jobId, { ...job, photoUrls: updated });

  return Response.json({ ok: true, remaining: updated.length });
}
