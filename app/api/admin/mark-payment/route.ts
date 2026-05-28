// app/api/admin/mark-payment/route.ts
// Manually override payment state — for cash payments, bank transfers, or admin corrections.
// POST { jobId, depositPaid?, finalPaid?, monthlyActive?, note? }

import { NextRequest, NextResponse } from "next/server";
import { getPaymentState, savePaymentState } from "@/lib/db";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, depositPaid, finalPaid, monthlyActive, note } = body;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const existing = await getPaymentState(jobId) || {
    deposit_paid: false, final_unlocked: false, final_paid: false, monthly_active: false, payments: {},
  };

  const updated = {
    depositPaid:   depositPaid   !== undefined ? depositPaid   : existing.deposit_paid,
    finalUnlocked: finalPaid     !== undefined ? finalPaid     : existing.final_unlocked,
    finalPaid:     finalPaid     !== undefined ? finalPaid     : existing.final_paid,
    monthlyActive: monthlyActive !== undefined ? monthlyActive : existing.monthly_active,
    payments: {
      ...(existing.payments || {}),
      ...(note ? { cashNote: { note, recordedAt: new Date().toISOString(), by: "admin" } } : {}),
    },
  };

  await savePaymentState(jobId, updated);

  return NextResponse.json({ ok: true, state: updated });
}
