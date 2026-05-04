// app/api/square/callback/route.ts
// Handles Square OAuth callback — exchanges authorisation code for access token,
// saves the client's Square credentials to their job in Supabase,
// then redirects them back to their client portal.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getJob, saveJob } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access
  if (error || !code || !stateParam) {
    const reason = error || "missing_code";
    return new Response(
      `<!DOCTYPE html><html><head><title>Square Connection Failed</title></head>
      <body style="font-family:sans-serif;background:#0a0f1a;color:#e2e8f0;padding:60px 24px;text-align:center;">
        <h1 style="color:#ef4444;">Connection Failed</h1>
        <p>Could not connect your Square account. Reason: ${reason}</p>
        <p>Please go back and try again.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Decode state to get slug + jobId
  let slug = "";
  let jobId = "";
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
    slug = decoded.slug || "";
    jobId = decoded.jobId || "";
  } catch {
    return new Response("Invalid state parameter", { status: 400 });
  }

  if (!slug || !jobId) {
    return new Response("Invalid state: missing slug or jobId", { status: 400 });
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
  } catch (e: any) {
    return new Response(
      `<!DOCTYPE html><html><head><title>Square Connection Failed</title></head>
      <body style="font-family:sans-serif;background:#0a0f1a;color:#e2e8f0;padding:60px 24px;text-align:center;">
        <h1 style="color:#ef4444;">Connection Failed</h1>
        <p>${e.message || "Could not exchange authorisation code."}</p>
        <a href="/c/${slug}" style="color:#00c896;">← Back to dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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
    const locData = await locRes.json();
    // Pick the first active location
    const locations: any[] = locData.locations || [];
    const active = locations.find((l: any) => l.status === "ACTIVE") || locations[0];
    locationId = active?.id || "";
    console.log(`[Square OAuth] Merchant ${merchantId} has ${locations.length} location(s), using: ${locationId}`);
  } catch (e) {
    console.error("[Square OAuth] Could not fetch locations:", e);
    // Non-fatal — payment links can still be created with a fallback
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

    // Also save to clients table for easy lookup
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
  } catch (e: any) {
    console.error("[Square OAuth] Failed to save credentials:", e);
    return new Response(
      `<!DOCTYPE html><html><head><title>Square Connection Failed</title></head>
      <body style="font-family:sans-serif;background:#0a0f1a;color:#e2e8f0;padding:60px 24px;text-align:center;">
        <h1 style="color:#ef4444;">Save Failed</h1>
        <p>Your Square account was authorised but we could not save the credentials. Please contact support.</p>
        <a href="/c/${slug}" style="color:#00c896;">← Back to dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Trigger a pipeline rebuild so shop payment links get wired into the site automatically
  try {
    await fetch(`${appUrl}/api/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, secret: process.env.PROCESS_SECRET }),
    });
    console.log(`[Square OAuth] Pipeline rebuild triggered for job ${jobId}`);
  } catch (e) {
    console.error("[Square OAuth] Could not trigger rebuild:", e);
    // Non-fatal — client can trigger manually from admin if needed
  }

  // Redirect back to client portal with success flag
  return Response.redirect(`${appUrl}/c/${slug}?square=connected`);
}
