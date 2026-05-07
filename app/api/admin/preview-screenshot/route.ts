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
    // Add cache-busting to bypass Vercel CDN cache on the target site
    const bustUrl = url + (url.includes("?") ? "&" : "?") + "_wg=" + Date.now();
    const res = await fetch(bustUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebGecko-Admin/1.0)",
        "Cache-Control": "no-cache, no-store",
        "Pragma": "no-cache",
      },
      cache: "no-store",
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
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    return new NextResponse("Failed to fetch preview", { status: 502 });
  }
}
