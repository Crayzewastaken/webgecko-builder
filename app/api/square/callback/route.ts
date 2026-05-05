// app/api/square/callback/route.ts
// Handles Square OAuth callback — exchanges authorisation code for access token,
// saves the client's Square credentials to their job in Supabase,
// then redirects them back to their client portal.

import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { getJob, saveJob, getClient } from "@/lib/db";

export const runtime = "nodejs";

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

/** Verify a state token built by buildOAuthState() in connect/route.ts */
function verifyOAuthState(
  token: string,
  secret: string,
): { slug: string; jobId: string; ts: number } | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function failPage(msg: string, backSlug = "") {
  return new Response(
    `<!DOCTYPE html><html><head><title>Square Connection Failed</title></head>
    <body style="font-family:sans-serif;background:#0a0f1a;color:#e2e8f0;padding:60px 24px;text-align:center;">
      <h1 style="color:#ef4444;">Connection Failed</h1>
      <p>${msg}</p>
      ${backSlug ? `<a href="/c/${backSlug}" style="color:#00c896;">← Back to dashboard</a>` : "<p>Please go back and try again.</p>"}
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !stateParam) {
    return failPage(`Could not connect your Square account. Reason: ${error || "missing_code"}`);
  }

  const stateSecret = process.env.OAUTH_STATE_SECRET || process.env.PROCESS_SECRET;
  if (!stateSecret) {
    console.error("[Square OAuth] OAUTH_STATE_SECRET not configured");
    return failPage("Server configuration error.");
  }

  // Verify HMAC signature and parse payload
  const payload = verifyOAuthState(stateParam, stateSecret);
  if (!payload) {
    return new Response("Invalid or tampered state parameter", { status: 400 });
  }

  const { slug, jobId, ts } = payload;

  // Reject stale states (replay protection)
  if (Date.now() - ts > STATE_MAX_AGE_MS) {
    return new Response("State token expired — please try connecting again", { status: 400 });
  }

  if (!slug || !jobId) {
    return new Response("Invalid state: missing slug or jobId", { status: 400 });
  }

  // Verify slug+jobId belong together (prevents state manipulation pointing at another client)
  const client = await getClient(slug);
  const clientJobId = (client as Record<string, unknown> | null)?.job_id as string | undefined;
  if (!client || clientJobId !== jobId) {
    console.error(`[Square OAuth] slug/jobId mismatch: slug=${slug} job_id=${clientJobId} vs jobId=${jobId}`);
    return new Response("slug/jobId mismatch", { status: 403 });
  }

  // Exchange code for access token
  const clientId = process.env.SQUARE_APPLICATION_ID!;
  const clientSecret = process.env.SQUARE_APPLICATION_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app";
  const redirectUri = `${appUrl}/api/square/callback`;

  const isProduction = process.env.SQUARE_ENVIRONMENT === "production";
  const squareBase = isProduction
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  let accessToken = "";
  let merchantId = "";
  let refreshToken = "";
  let expiresAt = "";

  try {
    const tokenRes = await fetch(`${squareBase}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": "2024-11-20" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[Square OAuth] Token exchange failed:", tokenData);
      throw new Error(tokenData?.message || "Token exchange failed");
    }

    accessToken = tokenData.access_token;
    merchantId = tokenData.merchant_id || "";
    refreshToken = tokenData.refresh_token || "";
    expiresAt = tokenData.expires_at || "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not exchange authorisation code.";
    return failPage(msg, slug);
  }

  // Get the merchant's primary location ID
  let locationId = "";
  try {
    const locRes = await fetch(`${squareBase}/v2/locations`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": "2024-11-20",
      },
    });
    const locData = await locRes.json() as { locations?: { status: string; id: string }[] };
    const locations = locData.locations || [];
    const active = locations.find((l) => l.status === "ACTIVE") || locations[0];
    locationId = active?.id || "";
    console.log(`[Square OAuth] Merchant ${merchantId} has ${locations.length} location(s), using: ${locationId}`);
  } catch (e) {
    console.error("[Square OAuth] Could not fetch locations:", e);
  }

  // Save credentials to the job
  try {
    const job = await getJob(jobId);
    if (job) {
      await saveJob(jobId, {
        ...job,
        squareAccessToken: accessToken,
        squareRefreshToken: refreshToken,
        squareTokenExpiresAt: expiresAt,
        squareMerchantId: merchantId,
        squareLocationId: locationId,
      });
    }

    await supabase
      .from("clients")
      .update({
        square_access_token: accessToken,
        square_refresh_token: refreshToken,
        square_token_expires_at: expiresAt,
        square_merchant_id: merchantId,
        square_location_id: locationId,
        square_connected_at: new Date().toISOString(),
      })
      .eq("slug", slug);

    console.log(`[Square OAuth] Connected: job=${jobId} slug=${slug} merchant=${merchantId} location=${locationId}`);
  } catch (e) {
    console.error("[Square OAuth] Failed to save credentials:", e);
    return failPage("Your Square account was authorised but we could not save the credentials. Please contact support.", slug);
  }

  // Trigger pipeline rebuild so shop payment links get wired in automatically
  try {
    await fetch(`${appUrl}/api/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, secret: process.env.PROCESS_SECRET }),
    });
    console.log(`[Square OAuth] Pipeline rebuild triggered for job ${jobId}`);
  } catch (e) {
    console.error("[Square OAuth] Could not trigger rebuild:", e);
  }

  return Response.redirect(`${appUrl}/c/${slug}?square=connected`);
}
