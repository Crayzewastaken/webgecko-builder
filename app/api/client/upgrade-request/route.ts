// app/api/client/upgrade-request/route.ts
// Client clicks "Add Social Media / Add Platform" upsell button → emails hello@webgecko.au
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { slug, businessName, email, type, extra } = await req.json();

    if (!slug || !businessName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const isAddPlatform = type === "add_platform";
    const subject = isAddPlatform
      ? `📱 Add Platform Request — ${businessName}`
      : `🚀 Social Media Upgrade Request — ${businessName}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1020;color:#c8d8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 28px;">
          <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;">
            ${isAddPlatform ? "📱 Add Platform Request" : "🚀 Social Media Upgrade Request"}
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);">A client wants to expand their package</div>
        </div>
        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:13px;color:#4a6898;width:140px;">Business</td>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:14px;font-weight:600;color:#d0e8ff;">${businessName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:13px;color:#4a6898;">Slug</td>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:14px;color:#d0e8ff;font-family:monospace;">${slug}</td>
            </tr>
            ${email ? `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:13px;color:#4a6898;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:14px;color:#d0e8ff;">${email}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:13px;color:#4a6898;">Request Type</td>
              <td style="padding:10px 0;border-bottom:1px solid #1e3560;font-size:14px;color:#a080ff;font-weight:700;">${isAddPlatform ? "Add Platform" : "New Social Media Bundle"}</td>
            </tr>
            ${extra ? `<tr>
              <td style="padding:10px 0;font-size:13px;color:#4a6898;vertical-align:top;">Details</td>
              <td style="padding:10px 0;font-size:14px;color:#d0e8ff;">${extra}</td>
            </tr>` : ""}
          </table>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <a href="https://webgeckofl.vercel.app/admin?secret=${process.env.PROCESS_SECRET}"
              style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:13px;font-weight:700;">
              Open Admin Dashboard →
            </a>
            <a href="https://webgeckofl.vercel.app/c/${slug}"
              style="display:inline-block;background:#102240;border:1px solid #1e3560;color:#80bbff;text-decoration:none;padding:11px 22px;border-radius:9px;font-size:13px;font-weight:600;">
              View Client Portal →
            </a>
          </div>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #1e3560;font-size:12px;color:#2a4060;">
          Sent automatically by WebGecko · ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })} AEST
        </div>
      </div>
    `;

    await resend.emails.send({
      from: "WebGecko <noreply@webgecko.au>",
      to: "hello@webgecko.au",
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
