// app/api/square/connect/route.ts
// Redirects client to Square OAuth authorisation page.
// Called from the client portal: /api/square/connect?slug=SLUG&jobId=JOBID

import { NextRequest } from "next/server";
import crypto from "crypto";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";

/** Build a tamper-proof state token: base64url(payload_json) + "." + hmac */
export function buildOAuthState(payload: Record<string, string | number>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const jobId = searchParams.get("jobId") || "";

  if (!slug || !jobId) {
    return new Response("Missing slug or jobId", { status: 400 });
  }

  // Require client session cookie — prevents unauthenticated CSRF initiation.
  const sessionSlug = req.cookies.get("wg_client_slug")?.value;
  if (!sessionSlug || sessionSlug !== slug) {
    return new Response("Not authenticated", { status: 401 });
  }

  // Verify slug+jobId belong together before handing off to Square.
  const client = await getClient(slug);
  const clientJobId = (client as Record<string, unknown> | null)?.job_id as string | undefined;
  if (!client || clientJobId !== jobId) {
    return new Response("slug/jobId mismatch", { status: 403 });
  }

  const clientId = process.env.SQUARE_APPLICATION_ID;
  if (!clientId) {
    return new Response("Square OAuth not configured (missing SQUARE_APPLICATION_ID)", { status: 500 });
  }

  const stateSecret = process.env.OAUTH_STATE_SECRET || process.env.PROCESS_SECRET;
  if (!stateSecret) {
    return new Response("OAUTH_STATE_SECRET not configured", { status: 500 });
  }

  const isProduction = process.env.SQUARE_ENVIRONMENT === "production";
  const baseUrl = isProduction
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  // Signed state — slug, jobId, timestamp, nonce prevent forgery and replay.
  const state = buildOAuthState(
    { slug, jobId, ts: Date.now(), nonce: crypto.randomBytes(8).toString("hex") },
    stateSecret,
  );

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
