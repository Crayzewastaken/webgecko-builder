// app/api/admin/offboard-social/route.ts
// Sends a formal social media offboarding confirmation email to a client.
// Called from the admin panel after you have manually:
//   1. Signed out of all social platforms
//   2. Reset the Gmail password
// This route emails the client their new Gmail password + legal confirmation.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      businessName,
      clientEmail,
      slug,
      gmailAddress,
      gmailPassword,
      platforms,
      handoverType, // "full" | "remove"
      adminNote,
    } = await req.json();

    if (!businessName || !clientEmail || !gmailAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });
    const platformList: string[] = Array.isArray(platforms) ? platforms : [];
    const isFull = handoverType === "full";

    const platformRows = platformList.length > 0
      ? platformList.map((p: string) =>
          "<tr>" +
          "<td style='padding:6px 0;font-size:13px;color:#4a6898;width:160px;border-bottom:1px solid #1e3560;'>Platform</td>" +
          "<td style='padding:6px 0;font-size:13px;font-weight:600;color:#d0e8ff;border-bottom:1px solid #1e3560;'>" + p + " — signed out ✓</td>" +
          "</tr>"
        ).join("")
      : "";

    const subject = isFull
      ? "[WebGecko] Social Account Handover — " + businessName
      : "[WebGecko] Social Management Stopped — " + businessName;

    const headerTitle = isFull
      ? "Your Social Accounts Have Been Handed Over"
      : "Social Media Management Stopped";

    const headerSub = isFull
      ? "All accounts and credentials are now yours. Below is your official confirmation."
      : "We've stopped all posting and management for your accounts.";

    const credentialsBlock = isFull && gmailPassword
      ? "<div style='background:#0d1f3c;border:1px solid #1e3560;border-radius:10px;padding:16px 20px;margin-bottom:20px;'>" +
        "<div style='font-size:11px;font-weight:700;color:#4a6898;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;'>Your Login Credentials</div>" +
        "<table style='width:100%;border-collapse:collapse;'>" +
        "<tr><td style='padding:6px 0;font-size:13px;color:#4a6898;width:160px;border-bottom:1px solid #1e3560;'>Gmail Address</td>" +
        "<td style='padding:6px 0;font-size:14px;font-weight:700;color:#c084fc;border-bottom:1px solid #1e3560;'>" + gmailAddress + "</td></tr>" +
        "<tr><td style='padding:6px 0;font-size:13px;color:#4a6898;width:160px;'>Temporary Password</td>" +
        "<td style='padding:6px 0;font-size:14px;font-weight:700;color:#c084fc;'>" + gmailPassword + "</td></tr>" +
        "</table>" +
        "<div style='margin-top:12px;font-size:12px;color:#2a6098;'>Change this password immediately after logging in. Use the Gmail account to reset passwords on each social platform.</div>" +
        "</div>"
      : "";

    const platformsBlock = platformRows
      ? "<div style='background:#0d1f3c;border:1px solid #1e3560;border-radius:10px;padding:16px 20px;margin-bottom:20px;'>" +
        "<div style='font-size:11px;font-weight:700;color:#4a6898;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;'>Sign-Out Confirmation</div>" +
        "<table style='width:100%;border-collapse:collapse;'>" + platformRows + "</table>" +
        "</div>"
      : "";

    const legalBlock =
      "<div style='background:#060e1c;border:1px solid #1e3560;border-radius:10px;padding:14px 18px;margin-bottom:20px;'>" +
      "<div style='font-size:11px;font-weight:700;color:#4a6898;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;'>Legal Confirmation</div>" +
      "<div style='font-size:12px;color:#4a6898;line-height:1.7;'>" +
      "This email serves as written confirmation that WebGecko has:" +
      "<ul style='margin:8px 0;padding-left:18px;'>" +
      (isFull
        ? "<li>Signed out of all connected social media platforms listed above</li>" +
          "<li>Reset the Gmail account password and transferred credentials to the client</li>" +
          "<li>Ceased all social media management activities for " + businessName + " effective " + timestamp + " AEST</li>" +
          "<li>Retained no ongoing access to any social accounts, Gmail, or associated platforms</li>"
        : "<li>Ceased all posting and community management for " + businessName + " effective " + timestamp + " AEST</li>" +
          "<li>Not transferred account credentials — accounts remain dormant under WebGecko management</li>" +
          "<li>Committed to making no posts, changes, or deletions to any connected accounts going forward</li>"
      ) +
      "</ul>" +
      "Cancellation takes effect at end of the current billing period. No refunds are issued for partial months. " +
      "WebGecko retains no liability for loss of followers, engagement, or account standing following this handover. " +
      "Re-engagement with WebGecko services requires a new agreement at prevailing rates." +
      "</div>" +
      "</div>";

    const noteBlock = adminNote
      ? "<div style='background:#0d1f3c;border:1px solid #1e3560;border-radius:10px;padding:14px 18px;margin-bottom:20px;'>" +
        "<div style='font-size:11px;font-weight:700;color:#4a6898;margin-bottom:6px;'>Note from our team</div>" +
        "<div style='font-size:13px;color:#b0cce8;line-height:1.6;'>" + adminNote + "</div>" +
        "</div>"
      : "";

    const gradientColor = isFull ? "#7c3aed,#a855f7" : "#1e3a5f,#2563eb";

    const html =
      "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1020;color:#c8d8f0;border-radius:12px;overflow:hidden;'>" +
        "<div style='background:linear-gradient(135deg," + gradientColor + ");padding:24px 28px;'>" +
          "<div style='font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;'>" + headerTitle + "</div>" +
          "<div style='font-size:14px;color:rgba(255,255,255,0.8);'>" + headerSub + "</div>" +
        "</div>" +
        "<div style='padding:28px;'>" +
          "<div style='font-size:14px;color:#b0cce8;line-height:1.7;margin-bottom:20px;'>" +
          "Hi " + businessName + ",<br/><br/>" +
          (isFull
            ? "As requested, we have completed the full handover of your social media accounts. All platforms have been signed out, your Gmail credentials are below, and we no longer have any access to your accounts."
            : "As requested, we have stopped all social media management for your business. No further posts, replies, or changes will be made to your accounts."
          ) +
          "</div>" +
          credentialsBlock +
          platformsBlock +
          legalBlock +
          noteBlock +
          "<div style='font-size:12px;color:#2a4060;margin-top:8px;'>Questions? Reply to this email or contact hello@webgecko.au</div>" +
        "</div>" +
        "<div style='padding:16px 28px;border-top:1px solid #1e3560;font-size:12px;color:#2a4060;'>" +
          "WebGecko · Sent " + timestamp + " AEST · Ref: " + (slug || businessName.toLowerCase().replace(/\s+/g, "-")) +
        "</div>" +
      "</div>";

    await resend.emails.send({
      from: "WebGecko <noreply@webgecko.au>",
      to: clientEmail,
      cc: ["hello@webgecko.au", "zackrmcsweeney@gmail.com"],
      replyTo: "hello@webgecko.au",
      subject,
      html,
    });

    return NextResponse.json({ ok: true, timestamp });
  } catch (err: any) {
    console.error("offboard-social error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
  }
}
