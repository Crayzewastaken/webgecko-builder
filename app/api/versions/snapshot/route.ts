// app/api/versions/snapshot/route.ts
// POST /api/versions/snapshot
// Body: { jobId, label?, trigger? }
// Auth: x-process-secret header
// Saves a full snapshot of the current job state to page_versions

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getJob } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-process-secret");
  if (secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string; label?: string; trigger?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const { jobId, label, trigger = "manual" } = body;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Count existing versions to auto-label
  const { count } = await supabase
    .from("page_versions")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  const versionLabel = label || (trigger === "build" ? `Build #${(count || 0) + 1}` : `Snapshot #${(count || 0) + 1}`);

  const { data, error } = await supabase
    .from("page_versions")
    .insert({
      job_id: jobId,
      label: versionLabel,
      trigger,
      html: job.html || null,
      job_config: {
        status: job.status,
        previewUrl: job.previewUrl,
        domainSlug: job.domainSlug,
        clientSlug: job.clientSlug,
        stripeAccountId: job.stripeAccountId,
        stripeConnectedAt: job.stripeConnectedAt,
        shopPlatform: job.shopPlatform,
        shopCatalogue: job.shopCatalogue,
        ga4Id: job.ga4Id,
        tawktoPropertyId: job.tawktoPropertyId,
        supersaasUrl: job.supersaasUrl,
        userInput: job.userInput,
        metadata: job.metadata,
        builtAt: job.builtAt,
      },
      logs: (job.metadata?.logs || []).slice(-200),
      screenshot_url: null, // populated separately if screenshot capture is set up
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, version: data });
}
