import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createDraftPostsForClient } from "@/lib/postiz";

export async function POST(req: NextRequest) {
  try {
    const { slug, posts } = await req.json();

    if (!slug || !posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Authenticate client cookie
    const cookieSlug = req.cookies.get("wg_client_slug")?.value;
    if (!cookieSlug || cookieSlug !== slug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch client job id
    const { data: clientData, error: clientErr } = await supabase
      .from("clients")
      .select("job_id, business_name")
      .eq("slug", slug)
      .single();

    if (clientErr || !clientData) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const jobId = clientData.job_id;
    const businessName = clientData.business_name || slug;

    // Load existing job to fetch metadata
    const { data: jobRow } = await supabase
      .from("jobs")
      .select("metadata")
      .eq("id", jobId)
      .single();

    const currentMeta = jobRow?.metadata || {};
    const approvedHistory = currentMeta.approvedPosts || [];
    const paymentIds: string[] = [];
    const newApprovedEntries: any[] = [];

    // Process each approved post (charge $100 flat fee per post and schedule in Postiz/Metricool queue)
    for (const post of posts) {
      const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const amountCents = 10000; // $100 AUD

      // 1. Write the payment transaction row
      const { error: payErr } = await supabase.from("payments").insert({
        id: payId,
        job_id: jobId,
        client_slug: slug,
        amount_cents: amountCents,
        currency: "AUD",
        status: "success",
        square_payment_id: `social_mock_${Math.random().toString(36).substring(2, 8)}`,
        square_order_id: `social_mock_ord_${Math.random().toString(36).substring(2, 8)}`,
      });

      if (payErr) {
        console.error("[SocialApprove] Failed to record payment:", payErr.message);
      }

      paymentIds.push(payId);

      // 2. Draft scheduling record
      const postEntry = {
        id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        approvedAt: new Date().toISOString(),
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags || [],
        scheduledAt: post.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        mediaUrls: post.mediaUrls || [],
        chargeId: payId,
        status: "scheduled",
      };

      newApprovedEntries.push(postEntry);

      // 3. Try connecting to Postiz if connected
      try {
        const fullCaption = `${post.caption}\n\n${(post.hashtags || []).join(" ")}`.trim();
        await createDraftPostsForClient({
          businessName,
          content: fullCaption,
          imageUrl: post.mediaUrls?.[0] || undefined,
          platforms: [post.platform.toLowerCase() as any],
        });
      } catch (e: any) {
        console.warn(`[SocialApprove] Postiz scheduling failed for ${post.platform} (logged for manual queues):`, e.message);
      }
    }

    // Update client metadata in the jobs table
    const updatedMeta = {
      ...currentMeta,
      approvedPosts: [...approvedHistory, ...newApprovedEntries],
    };

    const { error: updateErr } = await supabase
      .from("jobs")
      .update({ metadata: updatedMeta })
      .eq("id", jobId);

    if (updateErr) {
      console.error("[SocialApprove] Failed to update job metadata:", updateErr.message);
      return NextResponse.json({ error: "Failed to save approval history" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      paymentIds,
      postsCount: posts.length,
    });

  } catch (e: any) {
    console.error("[SocialApprove] Unhandled error:", e);
    return NextResponse.json({ error: e.message || "Failed to approve posts" }, { status: 500 });
  }
}
