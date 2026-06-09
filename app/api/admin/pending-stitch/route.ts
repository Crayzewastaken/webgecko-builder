// app/api/admin/pending-stitch/route.ts
// Returns all jobs currently in awaiting_stitch status for the admin pending page.

import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/db";
import { isAdminAuthed, isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req) && !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const allJobs = await listJobs(200);
  const pending = allJobs
    .filter((j: any) => j.buildStatus === "awaiting_stitch")
    .map((j: any) => ({
      jobId: j.id || j.jobId,
      businessName: j.userInput?.businessName || j.title || "Unknown",
      industry: j.userInput?.industry || "",
      pages: j.userInput?.pages || ["Home"],
      stitchPrompt: j.metadata?.stitchPrompt || "",
      awaitingStitchAt: j.metadata?.awaitingStitchAt || j.createdAt || "",
      clientEmail: j.userInput?.email || j.clientEmail || "",
    }));

  return NextResponse.json({ pending });
}
