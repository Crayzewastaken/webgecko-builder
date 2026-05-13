// lib/postiz.ts
// Postiz API helper — manages social media scheduling for all WebGecko clients.
// Each client is a separate "brand" in Postiz with their own connected channels.
// Docs: https://docs.postiz.com/public-api/introduction

const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY!;
const POSTIZ_BASE    = "https://api.postiz.com/public/v1";

async function postizRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>
) {
  const res = await fetch(`${POSTIZ_BASE}${path}`, {
    method,
    headers: {
      "Authorization": POSTIZ_API_KEY,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  console.log(`[Postiz] ${method} ${path} → HTTP ${res.status} | ${text.slice(0, 200)}`);
  if (!res.ok) throw new Error(`Postiz API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: string; // platform type e.g. "instagram", "facebook"
  picture?: string;
  disabled: boolean;
}

export interface PostizPost {
  id: string;
  content: string;
  status: "DRAFT" | "QUEUE" | "PUBLISHED" | "ERROR";
  publishDate?: string;
  integration: PostizIntegration;
}

export type PostizPlatform =
  | "instagram" | "facebook" | "tiktok" | "linkedin" | "linkedin-page"
  | "youtube" | "gmb" | "threads" | "x" | "pinterest";

export interface CreatePostOptions {
  /** Integration IDs to post to (get from listIntegrations) */
  integrationIds: string[];
  /** Post caption / content */
  content: string;
  /** Optional image URLs already uploaded to Postiz */
  imageIds?: Array<{ id: string; path: string }>;
  /** "draft" = sits waiting for approval, "schedule" = goes at date, "now" = immediate */
  type: "draft" | "schedule" | "now";
  /** Required when type is "schedule" — ISO 8601 */
  scheduledAt?: string;
  /** Platform-specific settings — auto-detected from integration if omitted */
  platformSettings?: Record<string, Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATIONS (connected channels)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all connected social media channels in your Postiz account.
 * In the UI these are called "channels", in the API they're "integrations".
 * Filter by clientName to find a specific client's channels.
 */
export async function listIntegrations(): Promise<PostizIntegration[]> {
  const data = await postizRequest("/integrations");
  return data.integrations || data || [];
}

/**
 * Find integrations for a specific client by searching their business name
 * in the integration name (you should name them "BusinessName - Platform" when connecting).
 */
export async function getClientIntegrations(businessName: string): Promise<PostizIntegration[]> {
  const all = await listIntegrations();
  const search = businessName.toLowerCase();
  return all.filter(i => i.name.toLowerCase().includes(search));
}

/**
 * Find the next available scheduling slot for a channel.
 * Useful for auto-spacing posts so they don't all go at the same time.
 */
export async function findAvailableSlot(integrationId: string): Promise<string> {
  const data = await postizRequest(`/integrations/${integrationId}/find-slot`);
  return data.date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload an image from a URL (e.g. a Pexels or Cloudinary URL) to Postiz.
 * Returns the Postiz image ID and path needed when creating posts.
 */
export async function uploadImageFromUrl(
  imageUrl: string
): Promise<{ id: string; path: string }> {
  const data = await postizRequest("/uploads/url", "POST", { url: imageUrl });
  return { id: data.id, path: data.path };
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a post (draft, scheduled, or immediate) across one or more platforms.
 *
 * For the WebGecko workflow:
 *   - Use type: "draft" when AI generates content → sits for admin approval
 *   - Use type: "schedule" when admin approves → set a future date
 *   - Use type: "now" for urgent/manual posts
 *
 * Each integration gets the same content but can have platform-specific settings.
 */
export async function createPost(opts: CreatePostOptions): Promise<{ groupId: string; posts: PostizPost[] }> {
  const {
    integrationIds,
    content,
    imageIds = [],
    type,
    scheduledAt,
    platformSettings = {},
  } = opts;

  // Build per-integration post objects
  const posts = integrationIds.map(id => ({
    integration: { id },
    value: [{ content, image: imageIds }],
    settings: platformSettings[id] || {},
  }));

  const payload = {
    type,
    date: scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    shortLink: false,
    tags: [],
    posts,
  };

  const data = await postizRequest("/posts", "POST", payload);
  return {
    groupId: data.id || data.group || "",
    posts: data.posts || [],
  };
}

/**
 * Change a post's status — e.g. approve a draft by moving it to QUEUE.
 * Use this when admin approves a pending post from the WebGecko dashboard.
 */
export async function approvePost(postId: string): Promise<void> {
  await postizRequest(`/posts/${postId}/status`, "PUT", { status: "QUEUE" });
}

/**
 * List posts within a date range. Useful for the admin calendar view.
 */
export async function listPosts(from: string, to: string): Promise<PostizPost[]> {
  const data = await postizRequest(`/posts?from=${from}&to=${to}`);
  return data.posts || data || [];
}

/**
 * List only DRAFT posts — these are the ones waiting for admin approval.
 */
export async function listPendingApprovals(): Promise<PostizPost[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
  const to   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead
  const all  = await listPosts(from, to);
  return all.filter(p => p.status === "DRAFT");
}

/**
 * Delete a post by ID.
 */
export async function deletePost(postId: string): Promise<void> {
  await postizRequest(`/posts/${postId}`, "DELETE");
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL HELPERS for WebGecko pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main function called by the Inngest pipeline after AI generates social content.
 *
 * Finds the client's connected channels in Postiz, uploads any images,
 * then creates DRAFT posts across all their platforms.
 * Admin reviews and approves from the WebGecko dashboard.
 *
 * @param businessName - Must match the prefix used when naming channels in Postiz
 *                       e.g. channels named "Tim's Plumbing - Instagram", "Tim's Plumbing - Facebook"
 * @param content      - AI-generated caption
 * @param imageUrl     - Optional image URL (from Pexels/Cloudinary)
 * @param platforms    - Platforms to post to — filters client's integrations
 */
export async function createDraftPostsForClient(opts: {
  businessName: string;
  content: string;
  imageUrl?: string;
  platforms?: PostizPlatform[];
}): Promise<{ success: boolean; draftCount: number; error?: string }> {
  try {
    const { businessName, content, imageUrl, platforms } = opts;

    // 1. Find this client's connected channels
    let integrations = await getClientIntegrations(businessName);
    if (integrations.length === 0) {
      return { success: false, draftCount: 0, error: `No Postiz channels found for "${businessName}". Connect their accounts first.` };
    }

    // 2. Filter to requested platforms if specified
    if (platforms && platforms.length > 0) {
      integrations = integrations.filter(i => platforms.includes(i.identifier as PostizPlatform));
    }

    // 3. Skip disabled integrations
    integrations = integrations.filter(i => !i.disabled);

    if (integrations.length === 0) {
      return { success: false, draftCount: 0, error: "No active/connected channels found for this client." };
    }

    // 4. Upload image if provided
    let imageIds: Array<{ id: string; path: string }> = [];
    if (imageUrl) {
      try {
        const uploaded = await uploadImageFromUrl(imageUrl);
        imageIds = [uploaded];
      } catch (e) {
        console.warn("[Postiz] Image upload failed, posting without image:", e);
      }
    }

    // 5. Create draft posts
    const result = await createPost({
      integrationIds: integrations.map(i => i.id),
      content,
      imageIds,
      type: "draft",
    });

    console.log(`[Postiz] Created ${result.posts.length} draft posts for ${businessName}`);
    return { success: true, draftCount: result.posts.length };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Postiz] createDraftPostsForClient failed:", msg);
    return { success: false, draftCount: 0, error: msg };
  }
}

/**
 * Schedule approved posts at optimal times across a week.
 * Call this when admin approves a batch for a client.
 *
 * @param integrationIds - The client's channel IDs
 * @param posts          - Array of { content, imageUrl } to schedule
 * @param startFrom      - ISO date to start scheduling from (defaults to now)
 */
export async function scheduleWeeklyPosts(opts: {
  integrationIds: string[];
  posts: Array<{ content: string; imageUrl?: string }>;
  startFrom?: string;
}): Promise<{ scheduled: number }> {
  const { integrationIds, posts, startFrom } = opts;
  let scheduled = 0;

  for (const post of posts) {
    try {
      // Find next available slot across all channels
      const slots = await Promise.all(integrationIds.map(id => findAvailableSlot(id)));
      const earliestSlot = slots.sort()[0];

      let imageIds: Array<{ id: string; path: string }> = [];
      if (post.imageUrl) {
        try { imageIds = [await uploadImageFromUrl(post.imageUrl)]; } catch {}
      }

      await createPost({
        integrationIds,
        content: post.content,
        imageIds,
        type: "schedule",
        scheduledAt: earliestSlot,
      });

      scheduled++;
      // Small delay to avoid rate limiting (30 req/hour)
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error("[Postiz] Failed to schedule post:", e);
    }
  }

  return { scheduled };
}
