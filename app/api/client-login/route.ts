import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// POST - login with username + password
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const clientData = await redis.get<any>(`client:${slug}`);

    if (!clientData) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (clientData.password !== password) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    return NextResponse.json({ slug, jobId: clientData.jobId });
  } catch (err) {
    console.error("Client login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

// GET - fetch client portal data by slug (used by dashboard page)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const clientData = await redis.get<any>(`client:${slug}`);
    if (!clientData) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Return client data without password
    const { password: _, ...safeData } = clientData;
    return NextResponse.json(safeData);
  } catch (err) {
    console.error("Client portal fetch error:", err);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}