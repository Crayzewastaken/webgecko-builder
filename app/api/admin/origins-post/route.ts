// app/api/admin/origins-post/route.ts
// Create a Postiz post directly from the 3D Origins admin section.
// Supports: post now, schedule for later, or save as draft.

import { NextRequest } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import { listIntegrations, createPost, uploadImageFromUrl } from "@/lib/postiz";

export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.POSTIZ_API_KEY) {
    return Response.json({ ok: false, error: "POSTIZ_API_KEY not configured", channels: [] });
  }

  try {
    const all = await listIntegrations();
    // Return all active channels — Origins picks what to post to
    return Response.json({
      ok: true,
      channels: all.filter(c => !c.disabled).map(c => ({
        id: c.id,
        name: c.name,
        platform: c.identifier,
        picture: c.picture,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg, channels: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.POSTIZ_API_KEY) {
    return Response.json({ ok: false, error: "POSTIZ_API_KEY not configured" }, { status: 500 });
  }

  let body: {
    integrationIds: string[];
    content: string;
    imageUrl?: string;
    type: "now" | "draft" | "schedule";
    scheduledAt?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { integrationIds, content, imageUrl, type, scheduledAt } = body;

  if (!integrationIds?.length) return Response.json({ ok: false, error: "No channels selected" }, { status: 400 });
  if (!content?.trim()) return Response.json({ ok: false, error: "Post content is required" }, { status: 400 });

  try {
    let imageIds: Array<{ id: string; path: string }> = [];
    if (imageUrl?.trim()) {
      try {
        const uploaded = await uploadImageFromUrl(imageUrl.trim());
        imageIds = [uploaded];
      } catch (e) {
        console.warn("[OriginsPost] Image upload failed, posting without image:", e);
      }
    }

    const result = await createPost({
      integrationIds,
      content: content.trim(),
      imageIds,
      type,
      scheduledAt: type === "schedule" ? scheduledAt : undefined,
    });

    return Response.json({ ok: true, groupId: result.groupId, postCount: result.posts.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
