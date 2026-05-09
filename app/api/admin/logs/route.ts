import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isAdminAuthedLegacy } from "@/lib/admin-auth";
import { getPipelineLogs } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req) && !isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const logs = await getPipelineLogs(300);
  return NextResponse.json({ logs });
}
