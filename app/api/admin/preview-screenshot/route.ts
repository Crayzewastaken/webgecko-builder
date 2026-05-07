// app/api/admin/preview-screenshot/route.ts
// Proxies a site URL and strips X-Frame-Options so it can be embedded in an iframe.
// Only accessible to authed admins.

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url).searchParams.get("url");
  if (!url || !url.startsWith("https://")) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WebGecko-Admin/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    const html = await res.text();
    // Rewrite relative URLs to absolute so assets load correctly
    const baseUrl = new URL(url).origin;
    const rewritten = html
      .replace(/(href|src)="\/(?!\/)/g, `$1="${baseUrl}/`)
      .replace(/(href|src)='\/(?!\/)/g, `$1='${baseUrl}/`);

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Explicitly allow embedding — strip X-Frame-Options
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "",
      },
    });
  } catch (e) {
    return new NextResponse("Failed to fetch preview", { status: 502 });
  }
}
