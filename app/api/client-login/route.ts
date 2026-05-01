import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";

// POST - login with username + password
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const clientData = await getClient(slug);

    if (!clientData) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if ((clientData as any).password !== password) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const response = NextResponse.json({ slug, jobId: clientData.job_id });
    response.cookies.set("wg_client_slug", slug, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
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

    const sessionSlug = req.cookies.get("wg_client_slug")?.value;
    if (!sessionSlug || sessionSlug !== slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientData = await getClient(slug);
    if (!clientData) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { password: _, ...safeData } = clientData as any;
    return NextResponse.json(safeData);
  } catch (err) {
    console.error("Client portal fetch error:", err);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}
