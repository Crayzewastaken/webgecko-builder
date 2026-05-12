// app/api/preview/proxy/route.ts
// Serves stored site HTML for the admin preview iframe.
// Auth: admin session cookie OR client session cookie (slug must match).
// A one-time _wg nonce param is accepted for the initial iframe load from the admin.
import { NextRequest } from "next/server";
import { getJob, getClient } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const slug = searchParams.get("slug");
  if (!jobId && !slug) return new Response("Missing params", { status: 400 });

  // Auth: must be admin session, OR client cookie matches slug
  const isAdmin = isAdminAuthedLegacy(req);
  if (!isAdmin) {
    // Allow client to view their own preview via slug + session cookie
    if (slug) {
      const sessionSlug = req.cookies.get("wg_client_slug")?.value;
      if (!sessionSlug || sessionSlug !== slug) {
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // jobId access requires admin
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let html = "";
  if (jobId) {
    const job = await getJob(jobId);
    html = job?.html || "";
  } else if (slug) {
    const client = await getClient(slug!);
    if (client?.job_id) {
      const job = await getJob(client.job_id);
      html = job?.html || "";
    }
  }

  if (!html) return new Response("Site not ready yet", { status: 404 });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin",
        "default-src 'self' https: data: blob:",
        "img-src https: data: blob:",
        "style-src 'unsafe-inline' https:",
        "script-src 'unsafe-inline' https:",
        "frame-src https:",
      ].join("; "),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
