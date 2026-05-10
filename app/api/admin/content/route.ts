// app/api/admin/content/route.ts
// CRUD for per-client content items: blog posts, newsletters, deals, products, reviews
// Stored in jobs.metadata.content[] — no extra table needed.

import { NextRequest } from "next/server";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export type ContentType = "blog" | "newsletter" | "deal" | "product" | "review";
export type ContentStatus = "draft" | "scheduled" | "live" | "archived";

export interface ContentItem {
  id: string;
  type: ContentType;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  // Common
  title: string;
  body: string;          // rich text / HTML or markdown
  // Blog-specific
  slug?: string;
  metaDescription?: string;
  tags?: string[];
  featuredImageUrl?: string;
  // Newsletter-specific
  subject?: string;
  beehiivPostId?: string;
  sentAt?: string;
  // Deal/Promo-specific
  discount?: string;     // e.g. "20% off"
  validUntil?: string;
  promoCode?: string;
  // Product-specific
  price?: number;
  currency?: string;
  sku?: string;
  stockCount?: number;
  imageUrls?: string[];
  squareCatalogId?: string;
  // Review-specific
  authorName?: string;
  rating?: number;
  platform?: string;     // "google" | "facebook" | "manual"
  // Client-request flag
  requestedByClient?: boolean;
  clientNote?: string;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// GET /api/admin/content?jobId=xxx[&type=blog]
export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const type = searchParams.get("type") as ContentType | null;
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  let items: ContentItem[] = (job.metadata?.content || []) as ContentItem[];
  if (type) items = items.filter(i => i.type === type);
  items = items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return Response.json({ items });
}

// POST /api/admin/content — create or update a content item
export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { jobId, item } = body;
  if (!jobId || !item) return Response.json({ error: "jobId + item required" }, { status: 400 });
  if (!item.type || !item.title) return Response.json({ error: "item.type + item.title required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const meta = job.metadata || {};
  const existing: ContentItem[] = meta.content || [];

  const now = new Date().toISOString();
  let saved: ContentItem;

  if (item.id) {
    // Update existing
    const idx = existing.findIndex(i => i.id === item.id);
    if (idx === -1) return Response.json({ error: "Item not found" }, { status: 404 });
    saved = { ...existing[idx], ...item, updatedAt: now };
    existing[idx] = saved;
  } else {
    // Create new
    saved = {
      id: makeId(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      ...item,
    };
    existing.unshift(saved);
  }

  await saveJob(jobId, { ...job, metadata: { ...meta, content: existing } });
  return Response.json({ ok: true, item: saved });
}

// DELETE /api/admin/content — delete a content item
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { jobId, itemId } = body;
  if (!jobId || !itemId) return Response.json({ error: "jobId + itemId required" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const meta = job.metadata || {};
  const existing: ContentItem[] = meta.content || [];
  const filtered = existing.filter(i => i.id !== itemId);
  if (filtered.length === existing.length) return Response.json({ error: "Item not found" }, { status: 404 });

  await saveJob(jobId, { ...job, metadata: { ...meta, content: filtered } });
  return Response.json({ ok: true });
}
