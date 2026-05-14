// app/api/client/upgrade-request/route.ts
// Handles all client upgrade/request actions -> emails hello@webgecko.au
// Types: social_bundle | add_platform | social_link_existing | social_create_accounts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const TYPE_LABELS: Record<string, string> = {
  social_bundle:          "New Social Media Bundle",
  add_platform:           "Add Platform",
  social_link_existing:   "Link Existing Accounts",
  social_create_accounts: "Full Account Creation Request",
  social_handover:        "Social Account Handover Request",
  social_remove:          "Stop Social Management Request",
};

function buildRow(label: string, value: string, highlight = false): string {
  const color  = highlight ? "#c084fc" : "#d0e8ff";
  const weight = highlight ? "700" : "500";
  return (
    "<tr>" +
    "<td style=\"padding:10px 0;border-bottom:1px solid #1e3560;font-size:13px;" +
    "color:#4a6898;width:140px;vertical-align:top;\">" + label + "</td>" +
    "<td style=\"padding:10px 0;border-bottom:1px solid #1e3560;font-size:14px;" +
    "font-weight:" + weight + ";color:" + color + "\">" + value + "</td>" +
    "</tr>"
  );
}

export async function POST(req: NextRequest) {
  try {
    const {
      slug, businessName, email, type,
      planName, planPrice,
      note,
      platforms,
      extra,
    } = await req.json();

    if (!slug || !businessName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const typeLabel = TYPE_LABELS[type] || type || "Upgrade Request";
    const planLabel = planName
      ? (planPrice ? planName + " -- $" + planPrice + "/mo" : planName)
      : null;

    const subjectIcon =
      type === "add_platform"           ? "Add Platform" :
      type === "social_create_accounts" ? "Account Setup" :
      type === "social_link_existing"   ? "Link Accounts" :
      type === "social_handover"        ? "Handover Request" :
      type === "social_remove"          ? "Stop Management" : "New Bundle";

    const subject = planLabel
      ? "[WebGecko] " + subjectIcon + ": " + planLabel + " -- " + businessName
      : "[WebGecko] " + subjectIcon + " -- " + businessName;

    const headerTitle =
      type === "social_create_accounts" ? "Account Creation Request" :
      type === "social_link_existing"   ? "Link Existing Accounts" :
      type === "add_platform"           ? "Add Platform Request" :
      type === "social_handover"        ? "Social Account Handover Request" :
      type === "social_remove"          ? "Stop Social Management Request" :
                                          "Social Media Bundle Request";

    const platformStr = Array.isArray(platforms) ? platforms.join(", ") : (platforms || "");

    const rowsHtml =
      buildRow("Business", businessName) +
      buildRow("Slug", slug) +
      (email        ? buildRow("Email", email) : "") +
      buildRow("Request Type", typeLabel, true) +
      (planLabel    ? buildRow("Plan Selected", planLabel, true) : "") +
      (platformStr  ? buildRow("Platforms", platformStr) : "") +
      (note         ? buildRow("Note", note) : "") +
      (extra        ? buildRow("Details", extra) : "");

    const adminUrl = "https://webgeckofl.vercel.app/admin";
    const portalUrl = "https://webgeckofl.vercel.app/c/" + slug;
    const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });

    const btnStyle1 = "display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);" +
      "color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:13px;font-weight:700;";
    const btnStyle2 = "display:inline-block;background:#102240;border:1px solid #1e3560;" +
      "color:#80bbff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:13px;font-weight:600;";

    const html =
      "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;" +
      "background:#0a1020;color:#c8d8f0;border-radius:12px;overflow:hidden;\">" +
        "<div style=\"background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 28px;\">" +
          "<div style=\"font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;\">" + headerTitle + "</div>" +
          "<div style=\"font-size:14px;color:rgba(255,255,255,0.8);\">" +
            "A client has submitted a request from their portal" +
          "</div>" +
        "</div>" +
        "<div style=\"padding:28px;\">" +
          "<table style=\"width:100%;border-collapse:collapse;margin-bottom:24px;\">" +
            rowsHtml +
          "</table>" +
          "<div style=\"display:flex;gap:12px;flex-wrap:wrap;\">" +
            "<a href=\"" + adminUrl + "\" style=\"" + btnStyle1 + "\">Open Admin Dashboard</a>" +
            "<a href=\"" + portalUrl + "\" style=\"" + btnStyle2 + "\">View Client Portal</a>" +
          "</div>" +
        "</div>" +
        "<div style=\"padding:16px 28px;border-top:1px solid #1e3560;font-size:12px;color:#2a4060;\">" +
          "Sent automatically by WebGecko " + timestamp + " AEST" +
        "</div>" +
      "</div>";

    await resend.emails.send({
      from: "WebGecko <noreply@webgecko.au>",
      to: "hello@webgecko.au",
      cc: ["zackrmcsweeney@gmail.com"],
      replyTo: email || undefined,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("upgrade-request error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
