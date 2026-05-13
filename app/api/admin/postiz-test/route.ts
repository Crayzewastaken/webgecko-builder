// app/api/admin/postiz-test/route.ts
// Tests the Postiz API connection and returns all connected channels.
// Used by the admin Social Media view to verify everything is wired correctly.

import { NextRequest } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import { listIntegrations } from "@/lib/postiz";

export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.POSTIZ_API_KEY) {
    return Response.json({
      ok: false,
      error: "POSTIZ_API_KEY is not set in environment variables.",
      channels: [],
    });
  }

  try {
    const channels = await listIntegrations();
    return Response.json({
      ok: true,
      channelCount: channels.length,
      channels: channels.map(c => ({
        id: c.id,
        name: c.name,
        platform: c.identifier,
        disabled: c.disabled,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg, channels: [] });
  }
}
