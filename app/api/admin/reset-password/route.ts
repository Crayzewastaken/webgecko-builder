// app/api/admin/reset-password/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import { Resend } from "resend";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(plaintext, salt, KEY_LEN, SCRYPT_PARAMS, (e, k) => (e ? rej(e) : res(k)))
  );
  return "scrypt:" + salt + ":" + hash.toString("hex");
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, newPassword } = await req.json();
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  const plaintext = newPassword?.trim() || crypto.randomBytes(5).toString("hex");
  const hashed = await hashPassword(plaintext);

  // Get client details for the email
  const { data: client } = await supabase
    .from("clients")
    .select("email, business_name, slug")
    .eq("slug", slug)
    .single();

  const { error } = await supabase
    .from("clients")
    .update({ password: hashed })
    .eq("slug", slug);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Email the client their new password
  if (client?.email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://webgecko-builder.vercel.app"}/client`;
      await resend.emails.send({
        from: "WebGecko <hello@webgecko.au>",
        to: client.email,
        subject: "Your WebGecko Dashboard Password Has Been Reset",
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#07070c;color:#e8e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1a1a2e,#0d0d18);padding:40px 40px 32px;text-align:center;border-bottom:1px solid #1a1a2e;">
              <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.03em;">WebGecko</div>
              <div style="font-size:13px;color:#8888aa;margin-top:4px;">Client Dashboard</div>
            </div>
            <div style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">Password Reset</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#c8c8e0;line-height:1.6;">
                Hi${client.business_name ? ` ${client.business_name}` : ""},<br><br>
                Your WebGecko client dashboard password has been reset. Use the credentials below to log in.
              </p>
              <div style="background:#12121f;border:1px solid #1a1a2e;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <div style="margin-bottom:12px;">
                  <div style="font-size:11px;font-weight:700;color:#8888aa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Username</div>
                  <div style="font-size:14px;color:#e8e8f0;font-family:monospace;">${slug}</div>
                </div>
                <div>
                  <div style="font-size:11px;font-weight:700;color:#8888aa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Temporary Password</div>
                  <div style="font-size:16px;color:#00c896;font-family:monospace;font-weight:700;letter-spacing:0.05em;">${plaintext}</div>
                </div>
              </div>
              <a href="${loginUrl}" style="display:block;background:#00c896;color:#07070c;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:24px;">
                Log In to Dashboard →
              </a>
              <p style="margin:0;font-size:12px;color:#8888aa;line-height:1.5;">
                Please change your password after logging in. If you did not request this reset, contact your WebGecko account manager immediately.
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[reset-password] Email send failed:", emailErr);
      // Non-fatal — password is still reset, just log the error
    }
  }

  return Response.json({
    success: true,
    slug,
    temporaryPassword: plaintext,
    emailSent: !!(client?.email && process.env.RESEND_API_KEY),
  });
}
