import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// POST - login with username + password, sets session
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const clientData = await redis.get<any>(`client:${slug}`);

    if (!clientData) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (clientData.password !== password) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const response = NextResponse.json({ slug, jobId: clientData.jobId });
    // Set a session cookie so the dashboard knows they're authed
    response.cookies.set("wg_client_slug", slug, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Client login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

// GET - fetch client portal data by slug
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    // Verify session cookie matches requested slug
    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    if (!sessionSlug || sessionSlug !== slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientData = await redis.get<any>(`client:${slug}`);
    if (!clientData) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Return without password
    const { password: _, ...safeData } = clientData;
    return NextResponse.json(safeData);
  } catch (err) {
    console.error("Client portal fetch error:", err);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}