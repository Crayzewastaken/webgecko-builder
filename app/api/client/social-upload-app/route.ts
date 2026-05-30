import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v2 as cloudinary } from "cloudinary";
import { supabase } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const PLATFORM_RULES: Record<string, { maxChars: number; hashtagCount: number; tone: string }> = {
  instagram:  { maxChars: 2200, hashtagCount: 15, tone: "visual, engaging, emoji-friendly" },
  facebook:   { maxChars: 10000, hashtagCount: 5, tone: "conversational, community-focused" },
  tiktok:     { maxChars: 150,  hashtagCount: 8, tone: "punchy, trend-aware, youth-friendly" },
  linkedin:   { maxChars: 3000, hashtagCount: 5, tone: "professional, insight-driven, brand-forward" },
  x:          { maxChars: 280,  hashtagCount: 2, tone: "concise, punchy, conversational" },
};

async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string, resourceType: "image" | "video" | "auto" = "auto"): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `social_app/${folder}`,
        public_id: filename.replace(/\.[^/.]+$/, ""),
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || "");
      }
    );
    uploadStream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const slug = form.get("slug") as string;
    const brief = form.get("brief") as string;
    const tone = (form.get("tone") as string) || "friendly";
    const platforms = JSON.parse((form.get("platforms") as string) || '["instagram","facebook"]') as string[];
    const voiceTranscript = (form.get("voiceTranscript") as string) || "";
    
    const mediaFiles = form.getAll("files") as File[];
    const voiceFile = form.get("voiceover") as File | null;

    if (!slug) {
      return NextResponse.json({ error: "Missing client slug" }, { status: 400 });
    }

    // Authenticate client cookie
    const cookieSlug = req.cookies.get("wg_client_slug")?.value;
    if (!cookieSlug || cookieSlug !== slug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch client data for context
    const { data: jobRow, error: jobErr } = await supabase
      .from("jobs")
      .select("id, user_input, metadata")
      .eq("client_slug", slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
      
    if (jobErr || !jobRow) {
      return NextResponse.json({ error: "Client job data not found" }, { status: 404 });
    }

    const businessName = jobRow.user_input?.businessName || slug;
    const industry = jobRow.user_input?.industry || "business";
    const city = jobRow.user_input?.city || jobRow.user_input?.location || "Australia";

    // 2. Upload media files to Cloudinary
    const mediaUrls: string[] = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      if (!file || !file.size) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filename = `media_${Date.now()}_${i}.${ext}`;
      try {
        const url = await uploadToCloudinary(buffer, slug, filename, file.type.startsWith("video") ? "video" : "image");
        if (url) mediaUrls.push(url);
      } catch (e: any) {
        console.error("[SocialUploadApp] Media upload failed:", e.message);
      }
    }

    // 3. Upload voiceover to Cloudinary (if present)
    let voiceoverUrl = "";
    if (voiceFile && voiceFile.size > 0) {
      const buffer = Buffer.from(await voiceFile.arrayBuffer());
      try {
        voiceoverUrl = await uploadToCloudinary(buffer, slug, `voice_${Date.now()}.wav`, "video");
      } catch (e: any) {
        console.error("[SocialUploadApp] Voiceover upload failed:", e.message);
      }
    }

    // 4. Construct AI prompt combining text brief + voice transcript details
    const mediaDesc = mediaUrls.length > 0
      ? `The client uploaded these photo/video URLs: ${mediaUrls.join(", ")}`
      : "No media files uploaded (text-only post context).";

    const voiceDesc = voiceTranscript
      ? `The client also did a voice recording containing these instructions:\n"${voiceTranscript}"`
      : "";

    const platformNorms = platforms
      .map(p => {
        const rules = PLATFORM_RULES[p.toLowerCase()] || { maxChars: 500, hashtagCount: 5, tone: "professional" };
        return `- ${p}: max ${rules.maxChars} characters, ${rules.hashtagCount} hashtags, tone: ${rules.tone}`;
      })
      .join("\n");

    const aiPrompt = `You are a social media specialist drafting posts for "${businessName}", a ${industry} business located in ${city}.

CLIENT TEXT BRIEF:
"${brief || "Create a general engaging post highlighting our services."}"

${voiceDesc}

${mediaDesc}

REQUESTED PLATFORMS RULES:
${platformNorms}

OVERALL TONALITY: ${tone}

TASK:
Write a custom social media post for EACH requested platform. For each platform:
1. Caption — engaging, matches specified platform rules and business profile. Include a clear call to action.
2. Hashtags — platform-appropriate list.
3. Optimal scheduled time — ISO 8601 string (with +10:00 timezone offset) scheduling the post for a high-engagement slot within the next 2-5 days.

Respond with ONLY valid JSON inside this structure, do not wrap in markdown tags or extra text:
{
  "posts": [
    {
      "platform": "instagram",
      "caption": "...",
      "hashtags": ["#tag1", "#tag2"],
      "scheduledAt": "2026-06-01T09:00:00+10:00"
    }
  ]
}`;

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: aiPrompt }],
    });

    const rawContent = aiRes.content[0]?.type === "text" ? aiRes.content[0].text : "";
    let drafts: any[] = [];
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        drafts = parsed.posts || [];
      }
    } catch {
      console.error("[SocialUploadApp] JSON Parse failure:", rawContent);
      return NextResponse.json({ error: "AI caption drafting failed to generate clean response" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      drafts,
      mediaUrls,
      voiceoverUrl,
      voiceTranscript,
    });

  } catch (e: any) {
    console.error("[SocialUploadApp] Unhandled error:", e);
    return NextResponse.json({ error: e.message || "Failed to process social upload" }, { status: 500 });
  }
}
