// app/api/newsletter-subscribe/route.ts
// Receives form submissions from newsletter sections injected into client sites.
// Client sites are on different domains so CORS headers are required.

import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
    }

    const { email, publicationId } = body as { email?: string; publicationId?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: CORS });
    }

    const pubId = publicationId || process.env.BEEHIIV_PUBLICATION_ID;
    const apiKey = process.env.BEEHIIV_API_KEY;

    if (!pubId || !apiKey) {
      console.warn("[newsletter-subscribe] Missing Beehiiv config");
      return NextResponse.json({ success: true }, { headers: CORS });
    }

    const normalizedPubId = pubId.startsWith("pub_") ? pubId : `pub_${pubId}`;

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${normalizedPubId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[newsletter-subscribe] Beehiiv error ${res.status}: ${err}`);
      return NextResponse.json({ success: true }, { headers: CORS });
    }

    console.log(`[newsletter-subscribe] Subscribed ${email} to ${normalizedPubId}`);
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (e) {
    console.error("[newsletter-subscribe] Unexpected error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
