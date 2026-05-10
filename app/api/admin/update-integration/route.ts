// app/api/admin/update-integration/route.ts
// Save integration credentials (Square, GA4) for a client job.

import { NextRequest } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { jobId, squareAccessToken, squareLocationId, squareRefreshToken, squareMerchantId, ga4Id } = body;

  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const updates: Record<string, any> = {};
  if (squareAccessToken !== undefined) updates.squareAccessToken = squareAccessToken;
  if (squareLocationId !== undefined) updates.squareLocationId = squareLocationId;
  if (squareRefreshToken !== undefined) updates.squareRefreshToken = squareRefreshToken;
  if (squareMerchantId !== undefined) updates.squareMerchantId = squareMerchantId;
  if (ga4Id !== undefined) updates.ga4Id = ga4Id;

  if (!Object.keys(updates).length) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  await saveJob(jobId, { ...job, ...updates });

  return Response.json({ ok: true, updated: Object.keys(updates) });
}
