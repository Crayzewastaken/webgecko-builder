// app/api/feature-requests/route.ts
// Client submits a feature upgrade request → stored in job.metadata.featureRequests
// Admin can read all requests, update status (pending → processing → draft → approved → live)
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getJob, saveJob } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

// All available add-on features a client can request
export const AVAILABLE_FEATURES = [
  { id: "Booking System",     icon: "📅", label: "Booking System",      desc: "Online booking calendar so customers can book appointments directly from your site." },
  { id: "Shop",               icon: "🛒", label: "Online Shop",          desc: "Sell products or services with Square-powered payments." },
  { id: "Live Chat",          icon: "💬", label: "Live Chat",            desc: "Tawk.to live chat widget so visitors can message you in real time." },
  { id: "Gallery",            icon: "🖼️", label: "Photo Gallery",        desc: "A dedicated gallery section showcasing your work or products." },
  { id: "Blog",               icon: "📰", label: "Blog",                 desc: "News/blog section to publish updates, tips and articles." },
  { id: "Newsletter",         icon: "📧", label: "Email Newsletter",     desc: "Newsletter opt-in form — grows your subscriber list via Beehiiv." },
  { id: "Growth",             icon: "📈", label: "Growth & Marketing",   desc: "Exit-intent pop-up, newsletter and SEO boost combined." },
  { id: "Pricing",            icon: "💰", label: "Pricing Section",      desc: "Clear pricing table or packages listed on your site." },
  { id: "Testimonials",       icon: "⭐", label: "Customer Reviews",     desc: "Showcase social proof with a testimonials carousel." },
  { id: "FAQ",                icon: "❓", label: "FAQ Section",          desc: "Answer common questions and reduce inbound enquiries." },
  { id: "Video Background",   icon: "🎬", label: "Video Background",     desc: "Full-screen video background hero section." },
  { id: "Portfolio",          icon: "🎨", label: "Portfolio",            desc: "A visual portfolio of your past work or case studies." },
];

// ─── GET — fetch requests for a job (client-facing) or all jobs (admin) ────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");

  // Admin: get all feature requests across all jobs
  if (secret) {
    if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, user_input, metadata, client_slug")
      .not("metadata->featureRequests", "is", null);

    const all: any[] = [];
    for (const job of jobs || []) {
      const requests = job.metadata?.featureRequests || [];
      for (const r of requests) {
        all.push({ ...r, jobId: job.id, clientSlug: job.client_slug, businessName: job.user_input?.businessName || job.client_slug });
      }
    }
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return Response.json({ requests: all });
  }

  // Client: get requests for their own job
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });

  const { data: clientRow } = await supabase.from("clients").select("job_id").eq("slug", slug).single();
  if (!clientRow?.job_id) return Response.json({ requests: [] });

  const job = await getJob(clientRow.job_id);
  const requests = job?.metadata?.featureRequests || [];
  return Response.json({ requests, availableFeatures: AVAILABLE_FEATURES });
}

// ─── POST — client submits a new feature request ────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, featureIds, message } = body;

  if (!slug || !Array.isArray(featureIds) || featureIds.length === 0) {
    return Response.json({ error: "Missing slug or featureIds" }, { status: 400 });
  }

  const { data: clientRow } = await supabase.from("clients").select("job_id, business_name").eq("slug", slug).single();
  if (!clientRow?.job_id) return Response.json({ error: "Client not found" }, { status: 404 });

  const job = await getJob(clientRow.job_id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const existing: any[] = job.metadata?.featureRequests || [];

  // Create one request record per feature
  const newRequests = featureIds.map((fid: string) => ({
    id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    featureId: fid,
    message: message || "",
    status: "pending",   // pending → processing → draft → approved → live
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draftUrl: null,
  }));

  const updatedRequests = [...existing, ...newRequests];

  await saveJob(clientRow.job_id, {
    ...job,
    metadata: { ...(job.metadata || {}), featureRequests: updatedRequests },
  });

  return Response.json({ ok: true, requests: newRequests });
}

// ─── PATCH — admin updates request status ───────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { jobId, requestId, status, draftUrl, adminNote, quotedFee } = body;

  if (!jobId || !requestId || !status) {
    return Response.json({ error: "Missing jobId, requestId or status" }, { status: 400 });
  }

  const VALID_STATUSES = ["pending", "processing", "draft", "approved", "live", "rejected"];
  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const requests: any[] = job.metadata?.featureRequests || [];
  const idx = requests.findIndex((r: any) => r.id === requestId);
  if (idx === -1) return Response.json({ error: "Request not found" }, { status: 404 });

  requests[idx] = {
    ...requests[idx],
    status,
    updatedAt: new Date().toISOString(),
    ...(draftUrl !== undefined ? { draftUrl } : {}),
    ...(adminNote !== undefined ? { adminNote } : {}),
    ...(quotedFee !== undefined ? { quotedFee } : {}),
  };

  await saveJob(jobId, {
    ...job,
    metadata: { ...(job.metadata || {}), featureRequests: requests },
  });

  // approved → trigger Inngest to inject feature into draft HTML
  if (status === "approved") {
    try {
      const { inngest } = await import("@/lib/inngest");
      await inngest.send({
        name: "feature/inject",
        data: { jobId, requestId, featureId: requests[idx].featureId },
      });
    } catch (e) {
      console.error("Failed to fire feature/inject event:", e);
    }
  }

  // live → trigger Inngest to push the feature to the real site
  if (status === "live") {
    try {
      const { inngest } = await import("@/lib/inngest");
      await inngest.send({
        name: "feature/go-live",
        data: { jobId, requestId, featureId: requests[idx].featureId },
      });
    } catch (e) {
      console.error("Failed to fire feature/go-live event:", e);
    }
  }

  return Response.json({ ok: true, request: requests[idx] });
}

  return Response.json({ ok: true, request: requests[idx] });
}
