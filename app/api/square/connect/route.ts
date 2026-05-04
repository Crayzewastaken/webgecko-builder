// app/api/square/connect/route.ts
// Redirects client to Square OAuth authorisation page.
// Called from the client portal: /api/square/connect?slug=SLUG&jobId=JOBID

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const jobId = searchParams.get("jobId") || "";

  if (!slug || !jobId) {
    return new Response("Missing slug or jobId", { status: 400 });
  }

  const clientId = process.env.SQUARE_APPLICATION_ID;
  if (!clientId) {
    return new Response("Square OAuth not configured (missing SQUARE_APPLICATION_ID)", { status: 500 });
  }

  const isProduction = process.env.SQUARE_ENVIRONMENT === "production";
  const baseUrl = isProduction
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  // State encodes slug+jobId so the callback knows which client to update.
  // Base64 so it survives URL encoding.
  const state = Buffer.from(JSON.stringify({ slug, jobId })).toString("base64url");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
  const redirectUri = `${appUrl}/api/square/callback`;

  // Scopes needed: create catalogue items, payment links, process payments
  const scopes = [
    "MERCHANT_PROFILE_READ",
    "PAYMENTS_READ",
    "PAYMENTS_WRITE",
    "ORDERS_READ",
    "ORDERS_WRITE",
    "ITEMS_READ",
    "ITEMS_WRITE",
    "ONLINE_STORE_SITE_READ",
  ].join("+");

  const oauthUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&scope=${scopes}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return Response.redirect(oauthUrl);
}
