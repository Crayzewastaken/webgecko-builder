/**
 * WebGecko Booking Diagnostic
 * Run: PROCESS_SECRET=xxx BASE_URL=https://webgecko-builder.vercel.app node /tmp/test_bookings.mjs <jobId> <clientSlug>
 * Or locally: node /tmp/test_bookings.mjs <jobId> <clientSlug>
 */
const BASE  = process.env.BASE_URL  || "http://localhost:3000";
const SECRET = process.env.PROCESS_SECRET || "";
const jobId  = process.argv[2];
const slug   = process.argv[3];

if (!jobId || !slug) {
  console.error("Usage: node test_bookings.mjs <jobId> <clientSlug>");
  process.exit(1);
}

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

async function get(url, cookies) {
  const headers = { "Content-Type": "application/json" };
  if (cookies) headers["Cookie"] = cookies;
  const r = await fetch(url, { headers });
  let body;
  try { body = await r.json(); } catch { body = await r.text(); }
  return { status: r.status, body };
}

async function run() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`WebGecko Booking Diagnostic`);
  console.log(`Base: ${BASE}`);
  console.log(`Job:  ${jobId}   Slug: ${slug}`);
  console.log(`${"=".repeat(60)}\n`);

  let errors = 0;

  // ── 1. Admin bookings route (secret-authenticated) ──────────────────
  console.log("── 1. Admin bookings API (/api/bookings) ──");
  if (!SECRET) {
    console.log(`${WARN} PROCESS_SECRET not set — skipping admin route test`);
  } else {
    const { status, body } = await get(`${BASE}/api/bookings?jobId=${jobId}&secret=${SECRET}`);
    if (status === 200) {
      const count = body?.bookings?.length ?? 0;
      console.log(`${PASS} Status 200 — ${count} booking(s) in Supabase`);
      if (count > 0) {
        const b = body.bookings[0];
        console.log(`     First: ${b.visitorName} | ${b.service} | ${b.date} ${b.time} | status=${b.status}`);
      } else {
        console.log(`${WARN} Zero bookings in Supabase bookings table for this job.`);
        console.log(`     → Is the booking system using SuperSaas (iframe) rather than Supabase?`);
        console.log(`     → Check if job.supersaasId is set — if yes, bookings live in SuperSaas only.`);
      }
    } else {
      console.log(`${FAIL} Status ${status}: ${JSON.stringify(body)}`);
      errors++;
    }
  }

  // ── 2. SuperSaas API — fetch job metadata ───────────────────────────
  console.log("\n── 2. Job metadata (supersaasId check) ──");
  if (!SECRET) {
    console.log(`${WARN} PROCESS_SECRET not set — skipping`);
  } else {
    const { status, body } = await get(`${BASE}/api/admin/clients?secret=${SECRET}`);
    if (status === 200) {
      const clients = body?.clients || body || [];
      const match = Array.isArray(clients) ? clients.find((c) => c.jobId === jobId || c.job_id === jobId) : null;
      if (match) {
        const ssId = match.supersaasId || match.supersaas_id;
        const ssUrl = match.supersaasUrl || match.supersaas_url;
        console.log(`${PASS} Client found in admin list`);
        console.log(`     supersaasId : ${ssId ?? "NULL ← this is the problem"}`);
        console.log(`     supersaasUrl: ${ssUrl ?? "NULL"}`);
        if (!ssId) {
          console.log(`${FAIL} supersaasId is NULL — /api/bookings/supersaas will always return [] because`);
          console.log(`     it checks 'if (!scheduleId) return []' immediately.`);
          errors++;
        }
      } else {
        console.log(`${WARN} Job ${jobId} not found in clients list`);
      }
    } else {
      console.log(`${FAIL} Admin clients: ${status} — ${JSON.stringify(body)}`);
    }
  }

  // ── 3. Client portal bookings route (unauthenticated — expect 401) ──
  console.log("\n── 3. Client portal API without auth (expect 401) ──");
  {
    const { status } = await get(`${BASE}/api/bookings/client?jobId=${jobId}&slug=${slug}`);
    if (status === 401) {
      console.log(`${PASS} Correctly returns 401 without auth cookie`);
    } else {
      console.log(`${WARN} Expected 401, got ${status} — auth may be misconfigured`);
    }
  }

  // ── 4. SuperSaas portal route (unauthenticated — expect 401) ────────
  console.log("\n── 4. SuperSaas route without auth (expect 401) ──");
  {
    const { status } = await get(`${BASE}/api/bookings/supersaas?slug=${slug}`);
    if (status === 401) {
      console.log(`${PASS} Correctly returns 401 without auth cookie`);
    } else {
      console.log(`${WARN} Expected 401, got ${status} — auth may be misconfigured`);
    }
  }

  // ── 5. Supabase bookings table — direct count via admin route ───────
  console.log("\n── 5. Supabase bookings table check ──");
  if (!SECRET) {
    console.log(`${WARN} Skipping — no PROCESS_SECRET`);
  } else {
    const { status, body } = await get(`${BASE}/api/bookings?jobId=${jobId}&secret=${SECRET}`);
    if (status === 200) {
      const count = body?.total ?? body?.bookings?.length ?? 0;
      if (count === 0) {
        console.log(`${WARN} No rows in Supabase bookings table for jobId=${jobId}`);
        console.log(`     DIAGNOSIS: Bookings go through SuperSaas iframe — they are NOT stored`);
        console.log(`     in Supabase. The client portal's bookings tab calls /api/bookings/supersaas`);
        console.log(`     which needs a valid supersaasId on the job row.`);
      } else {
        console.log(`${PASS} ${count} row(s) in Supabase bookings table`);
      }
    }
  }

  // ── 6. Summary ───────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  if (errors === 0) {
    console.log(`${PASS} Diagnostic complete — no hard errors`);
  } else {
    console.log(`${FAIL} ${errors} error(s) found — see above`);
  }

  console.log(`\nMOST LIKELY CAUSES:`);
  console.log(`  A) job.supersaasId is NULL → /api/bookings/supersaas short-circuits and returns []`);
  console.log(`     Fix: run the supabase-migration-run-now.sql migration to add supersaas_id column,`);
  console.log(`     then re-activate the job (or manually UPDATE jobs SET supersaas_id=X WHERE id=Y)`);
  console.log(`  B) supersaasId is set but the schedule name doesn't match the fileName`);
  console.log(`     Fix: log into SuperSaas and confirm the schedule exists with the exact fileName`);
  console.log(`  C) SuperSaas API credentials missing (SUPERSAAS_ACCOUNT_NAME / SUPERSAAS_API_KEY)`);
  console.log(`     Fix: check Vercel env vars`);
  console.log(`  D) Admin dashboard shows bookingCount from Supabase bookings table, not SuperSaas`);
  console.log(`     Fix: see Issue 020 — these are two separate data sources`);
  console.log(`${"=".repeat(60)}\n`);
}

run().catch(console.error);
