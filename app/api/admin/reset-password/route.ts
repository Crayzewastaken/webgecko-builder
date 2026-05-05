// app/api/admin/reset-password/route.ts
// Resets a client's login password. Called from the admin dashboard.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

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

  // Generate a random plaintext password, show it once, then s
  const plaintext = newPassword?.trim() || crypto.randomBytes(5).toString("hex");
  const hashed = await hashPassword(plaintext);

  const { error } = await supabase
    .from("clients")
    .update({ password: hashed })
    .eq("slug", slug);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Return the plaintext once so the admin can send it to the client.
  // It is never stored. The hash is what lives in the DB.
  return Response.json({ success: true, slug, temporaryPassword: plaintext });
}
