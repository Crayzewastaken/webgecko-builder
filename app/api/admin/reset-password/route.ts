// app/api/admin/reset-password/route.ts
// Resets a client's login password. Called from the admin dashboard.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.PROCESS_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, newPassword } = await req.json();
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  // Generate a new password if none provided
  const password = newPassword?.trim() || crypto.randomBytes(5).toString("hex");

  const { error } = await supabase
    .from("clients")
    .update({ password })
    .eq("slug", slug);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, slug, password });
}
