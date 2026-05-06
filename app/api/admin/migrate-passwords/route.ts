// app/api/admin/migrate-passwords/route.ts
// One-time migration: hash all plain-text client passwords in the DB.
// POST /api/admin/migrate-passwords  (admin auth required)
// Safe to run multiple times — already-hashed passwords are skipped.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";
import crypto from "crypto";

export const runtime = "nodejs";

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

  // Fetch all clients with a password field
  const { data: clients, error } = await supabase
    .from("clients")
    .select("slug, password")
    .not("password", "is", null);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const client of clients || []) {
    const pw: string = client.password || "";

    // Already hashed — skip
    if (pw.startsWith("scrypt:")) {
      skipped++;
      continue;
    }

    // Plain-text — hash it
    try {
      const hashed = await hashPassword(pw);
      const { error: updateErr } = await supabase
        .from("clients")
        .update({ password: hashed })
        .eq("slug", client.slug);

      if (updateErr) {
        errors.push(`${client.slug}: ${updateErr.message}`);
      } else {
        migrated++;
      }
    } catch (e) {
      errors.push(`${client.slug}: ${String(e)}`);
    }
  }

  return Response.json({
    ok: true,
    total: (clients || []).length,
    migrated,
    skipped,
    errors,
  });
}
