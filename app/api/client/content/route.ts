// app/api/client/content/route.ts
// Client portal: view their published content + submit content requests
// Auth pattern: same as /api/feature-requests — slug-only for client, admin secret for admin reads

import { NextRequest } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { ContentItem } from "@/app/api/admin/content/route";

async function getLatestJobBySlug(slug: string): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("client_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!data?.id) return null;
  return getJob(data.id);
}

// GET /api/client/content?slug=xxx[&type=blog]
// Returns only live/scheduled items — clients never see drafts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const type = searchParams.get("type");

  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  const job = await getLatestJobBySlug(slug);
  if (!job) return Response.json({ items: [] });

  const items: ContentItem[] = (job.metadata?.content || []) as ContentItem[];
  const visible = items.filter(i => i.status === "live" || i.status === "scheduled");
  const filtered = type ? visible.filter(i => i.type === type) : visible;

  return Response.json({ items: filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")) });
}

// POST /api/client/content — client submits a content request
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { slug, type, title, body: itemBody, clientNote, ...extra } = body;
  if (!slug || !type || !title) {
    return Response.json({ error: "slug, type, title required" }, { status: 400 });
  }

  // Auth: client cookie must match slug, OR admin secret header
  const cookieSlug = req.cookies.get("wg_client_slug")?.value;
  const adminSecret = req.headers.get("x-process-secret");
  const isAdmin = adminSecret && adminSecret === process.env.PROCESS_SECRET;
  if (!isAdmin && cookieSlug !== slug) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await getLatestJobBySlug(slug);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const meta = job.metadata || {};
  const existing: ContentItem[] = meta.content || [];
  const now = new Date().toISOString();

  const newItem: ContentItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: type as ContentItem["type"],
    status: "draft",
    title,
    body: itemBody || "",
    clientNote: clientNote || "",
    requestedByClient: true,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };

  existing.unshift(newItem);
  await saveJob(job.id, { ...job, metadata: { ...meta, content: existing } });

  return Response.json({ ok: true, item: newItem });
}
