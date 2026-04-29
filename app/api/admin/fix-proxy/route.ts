// app/api/admin/fix-proxy/route.ts
// JSON wrapper around the fix endpoint so admin dashboard can call it cleanly.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret || secret !== process.env.PROCESS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko.au";
    const res = await fetch(`${base}/api/fix?jobId=${encodeURIComponent(jobId)}&secret=${encodeURIComponent(secret)}`);
    if (!res.ok) {
      return NextResponse.json({ error: `Fix failed: HTTP ${res.status}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
