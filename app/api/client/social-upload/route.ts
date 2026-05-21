// app/api/client/social-upload/route.ts
// Client uploads media + brief → AI drafts captions → auto-creates Postiz drafts.
//
// Flow:
//   1. Receive multipart: files[] (photos/videos), brief, slug, tone, platforms
//   2. Upload each file to Supabase Storage (bucket: social-uploads)
//   3. Call Claude to generate caption + hashtags + optimal schedule time per platform
//   4. Upload image(s) to Postiz, create DRAFT posts across all client channels
//   5. Return { ok, draftCount, postIds }

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { createDraftPostsForClient, uploadImageFromUrl } from "@/lib/postiz";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BUCKET = "social-uploads";

// ── Per-platform content rules ────────────────────────────────────────────────
const PLATFORM_RULES: Record<string, { maxChars: number; hashtagCount: number; tone: string }> = {
  instagram:  { maxChars: 2200, hashtagCount: 20, tone: "visual, engaging, emoji-friendly" },
  facebook:   { maxChars: 63206, hashtagCount: 5, tone: "conversational, community-focused" },
  tiktok:     { maxChars: 150,  hashtagCount: 8, tone: "punchy, trend-aware, youth-friendly" },
  linkedin:   { maxChars: 3000, hashtagCount: 5, tone: "professional, insight-driven" },
  "linkedin-page": { maxChars: 3000, hashtagCount: 5, tone: "professional, brand-forward" },
  x:          { maxChars: 280,  hashtagCount: 2, tone: "concise, punchy, conversational" },
  threads:    { maxChars: 500,  hashtagCount: 3, tone: "casual, community-focused" },
  pinterest:  { maxChars: 500,  hashtagCount: 5, tone: "descriptive, keyword-rich, inspirational" },
  youtube:    { maxChars: 5000, hashtagCount: 8, tone: "descriptive, SEO-optimised" },
  gmb:        { maxChars: 1500, hashtagCount: 0, tone: "local, helpful, professional" },
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const slug      = form.get("slug") as string;
    const brief     = form.get("brief") as string;
    const tone      = (form.get("tone") as string) || "friendly";
    const platforms = JSON.parse((form.get("platforms") as string) || '["instagram","facebook"]') as string[];
    const files     = form.getAll("files") as File[];
    // Also accept legacy single-file "photo" key
    const legacyPhoto = form.get("photo") as File | null;
    const allFiles = files.length > 0 ? files : (legacyPhoto ? [legacyPhoto] : []);

    if (!slug || !brief?.trim()) {
      return Response.json({ ok: false, error: "Missing slug or brief" }, { status: 400 });
    }

    // Authenticate: check client session cookie
    const cookieSlug = req.cookies.get("wg_client_slug")?.value;
    if (!cookieSlug || cookieSlug !== slug) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 1. Load client job to get business name + metadata
    const { data: jobRow, error: jobErr } = await supabase
      .from("jobs")
      .select("id, user_input, metadata")
      .eq("client_slug", slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (jobErr || !jobRow) return Response.json({ ok: false, error: "Client not found" }, { status: 404 });
    const businessName: string = jobRow.user_input?.businessName || slug;
    const industry: string = jobRow.user_input?.industry || "business";
    const city: string = jobRow.user_input?.city || jobRow.user_input?.location || "Australia";

    // 2. Upload files to Supabase Storage, collect public URLs
    const mediaUrls: string[] = [];
    for (const file of allFiles) {
      if (!file || !file.size) continue;
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
      if (upErr) {
        console.warn(`[SocialUpload] Storage upload failed for ${file.name}:`, upErr.message);
        continue;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (urlData?.publicUrl) mediaUrls.push(urlData.publicUrl);
    }

    const hasMedia = mediaUrls.length > 0;
    const mediaDesc = hasMedia
      ? `The client has uploaded ${mediaUrls.length} media file(s): ${mediaUrls.join(", ")}`
      : "No media files were uploaded — text-only post.";

    // 3. Build platform-specific prompts
    const platformNorms = platforms
      .map(p => {
        const rules = PLATFORM_RULES[p.toLowerCase()] || { maxChars: 500, hashtagCount: 5, tone: "professional" };
        return `- ${p}: max ${rules.maxChars} chars, ${rules.hashtagCount} hashtags, tone: ${rules.tone}`;
      })
      .join("\n");

    const aiPrompt = `You are a social media manager for "${businessName}", a ${industry} business based in ${city}.

CLIENT BRIEF:
"${brief}"

${mediaDesc}

REQUESTED PLATFORMS:
${platformNorms}

OVERALL TONE: ${tone}

TASK: Write a complete social media post for EACH platform above. For each platform:
1. Caption — platform-appropriate length and tone. Mention the business naturally. Include a call to action.
2. Hashtags — the right number for that platform, highly relevant.
3. Best posting time — day of week + time (AEST) based on engagement best practices for ${industry}.

Respond with ONLY valid JSON in this exact format, no markdown:
{
  "posts": [
    {
      "platform": "instagram",
      "caption": "...",
      "hashtags": ["#tag1", "#tag2"],
      "scheduledAt": "2024-01-15T09:00:00+10:00"
    }
  ]
}`;

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: aiPrompt }],
    });

    const rawAi = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
    let aiPosts: Array<{ platform: string; caption: string; hashtags: string[]; scheduledAt: string }> = [];
    try {
      const jsonMatch = rawAi.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiPosts = parsed.posts || [];
      }
    } catch {
      console.error("[SocialUpload] AI JSON parse failed:", rawAi.slice(0, 200));
      return Response.json({ ok: false, error: "AI content generation failed" }, { status: 500 });
    }

    if (aiPosts.length === 0) {
      return Response.json({ ok: false, error: "AI returned no posts" }, { status: 500 });
    }

    // 4. Upload first image to Postiz (Postiz takes URLs, not raw files)
    let postizImageIds: Array<{ id: string; path: string }> = [];
    if (mediaUrls.length > 0) {
      try {
        const uploaded = await uploadImageFromUrl(mediaUrls[0]);
        postizImageIds = [uploaded];
      } catch (e) {
        console.warn("[SocialUpload] Postiz image upload failed (posting without image):", e);
      }
    }

    // 5. Create draft posts in Postiz — one per platform/caption
    const draftResults: Array<{ platform: string; success: boolean; error?: string }> = [];
    let totalDrafts = 0;

    for (const post of aiPosts) {
      const caption = `${post.caption}\n\n${post.hashtags.join(" ")}`.trim();
      try {
        const result = await createDraftPostsForClient({
          businessName,
          content: caption,
          imageUrl: mediaUrls[0],
          platforms: [post.platform as any],
        });
        draftResults.push({ platform: post.platform, success: result.success, error: result.error });
        if (result.success) totalDrafts += result.draftCount;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        draftResults.push({ platform: post.platform, success: false, error: msg });
      }
    }

    // 6. Log the upload event on the job
    try {
      const existingMedia: any[] = jobRow.metadata?.socialUploads || [];
      await supabase.from("jobs").update({
        metadata: {
          ...(jobRow.metadata || {}),
          socialUploads: [
            ...existingMedia,
            {
              uploadedAt: new Date().toISOString(),
              brief: brief.slice(0, 300),
              mediaUrls,
              platforms,
              draftCount: totalDrafts,
            },
          ],
        },
      }).eq("id", jobRow.id);
    } catch (e) {
      console.warn("[SocialUpload] Failed to log upload to job metadata:", e);
    }

    return Response.json({
      ok: true,
      draftCount: totalDrafts,
      mediaUploaded: mediaUrls.length,
      platforms: draftResults,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SocialUpload] Unhandled error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
