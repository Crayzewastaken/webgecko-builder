// app/api/admin/activate — called when admin ticks checklist + clicks "Activate & Launch"
// 1. Saves checklist completion to job.metadata
// 2. Triggers a full rebuild (so the real SuperSaas schedule URL gets embedded)
// 3. Sets metadata.scheduledReleaseAt = now + N days based on site complexity
// The Inngest scheduled function "auto-release" picks this up and releases when the time comes.

import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export const maxDuration = 30;

// Days until auto-release based on site complexity
function calcReleaseDays(job: any): number {
  const features: string[] = Array.isArray(job.userInput?.features) ? job.userInput.features : [];
  const siteType = job.userInput?.siteType || "single";
  const pages: string[] = Array.isArray(job.userInput?.pages) ? job.userInput.pages : [];

  let days = 10; // base
  if (siteType === "multi" || pages.length > 3) days += 1;
  if (features.length > 3) days += 1;
  return Math.min(days, 12); // cap at 12
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const releaseDays = calcReleaseDays(job);
    const releaseAt = new Date(Date.now() + releaseDays * 24 * 60 * 60 * 1000).toISOString();

    // Save checklist completion + scheduled release date
    await saveJob(jobId, {
      ...job,
      metadata: {
        ...(job.metadata || {}),
        checklistCompletedAt: new Date().toISOString(),
        scheduledReleaseAt: releaseAt,
        scheduledReleaseDays: releaseDays,
      },
    });

    // Trigger full rebuild so the real SuperSaas schedule URL gets embedded
    await inngest.send({ name: "build/website", data: { jobId } });

    return NextResponse.json({
      ok: true,
      message: `Rebuild triggered. Site will auto-release to client in ${releaseDays} days (${new Date(releaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}).`,
      releaseAt,
      releaseDays,
    });
  } catch (err) {
    console.error("[Activate] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
