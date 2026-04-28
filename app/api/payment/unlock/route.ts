// app/api/payment/unlock/route.ts
// Owner-only — unlocks the final 50% payment for a client, then emails them.
import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const secret = searchParams.get("secret");

  if (!jobId || !secret) return page("Missing params", "#ef4444", 400);
  if (secret !== process.env.PROCESS_SECRET) return page("Forbidden", "#ef4444", 403);

  const paymentStateKey = "payment:" + jobId;
  const existing = await redis.get<any>(paymentStateKey) || {
    depositPaid: false, finalUnlocked: false, finalPaid: false, monthlyActive: false, payments: {},
  };

  if (!existing.depositPaid) return page("Cannot unlock — deposit not yet paid.", "#f59e0b");
  if (existing.finalUnlocked) return page("Already unlocked for this client.", "#0099ff");

  await redis.set(paymentStateKey, {
    ...existing,
    finalUnlocked: true,
    finalUnlockedAt: new Date().toISOString(),
  });

  console.log("Final payment unlocked for jobId=" + jobId);

  // Email client
  const job = await redis.get<any>("job:" + jobId);
  const clientSlug = job?.clientSlug || "";
  const clientEmail = job?.email || "";
  const businessName = job?.userInput?.businessName || "your website";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
  const portalUrl = base + "/c/" + clientSlug;

  if (clientEmail) {
    try {
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: clientEmail,
        subject: "Your Website is Ready to Launch — " + businessName,
        html: [
          "<!DOCTYPE html><html><body style='margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;'>",
          "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0a0f1a;padding:40px 20px;'><tr><td align='center'>",
          "<table width='600' cellpadding='0' cellspacing='0' style='background:#0f1623;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);'>",
          "<tr><td style='background:linear-gradient(135deg,#8b5cf6,#0099ff);padding:28px 32px;'>",
          "<h1 style='margin:0;color:#fff;font-size:22px;'>Time to Launch!</h1></td></tr>",
          "<tr><td style='padding:32px;'>",
          "<p style='color:#94a3b8;margin:0 0 16px;'>Hi there,</p>",
          "<p style='color:#e2e8f0;margin:0 0 16px;'>Your website for <strong style='color:#8b5cf6;'>" + businessName + "</strong> is approved and ready to go live.</p>",
          "<p style='color:#e2e8f0;margin:0 0 24px;'>To complete your launch, please pay the final balance via your client portal. Once paid, your site goes live within minutes.</p>",
          "<a href='" + portalUrl + "' style='display:inline-block;background:linear-gradient(135deg,#8b5cf6,#0099ff);color:#fff;font-weight:800;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:14px;'>Pay Final Balance and Launch</a>",
          "</td></tr><tr><td style='padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);'>",
          "<p style='color:#475569;font-size:12px;margin:0;'>Sent by <strong style='color:#8b5cf6;'>WebGecko</strong></p>",
          "</td></tr></table></td></tr></table></body></html>",
        ].join(""),
      });
      console.log("Final unlock email sent to " + clientEmail);
    } catch (e) { console.error("Final unlock email failed:", e); }
  }

  return page("Final payment unlocked — client has been emailed.", "#00c896");
}

function page(message: string, color: string, status = 200) {
  return new Response(
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>" +
    "<body style='margin:0;background:#0f0f0f;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;'>" +
    "<div style='background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:48px;max-width:480px;text-align:center;'>" +
    "<p style='color:" + color + ";font-size:16px;margin:0;'>" + message + "</p>" +
    "</div></body></html>",
    { headers: { "Content-Type": "text/html" }, status }
  );
}
