# WebGecko Pipeline Error Log
_All issues logged here. Format: symptom → root cause → fix → status. Dated when occurred._

---

| # | Summary | Status | Date |
|---|---------|--------|------|
| 001 | Booking iframe shows SuperSaas template | ✅ Fixed | Pre-2026-04 |
| 002 | Hamburger button not wired | ✅ Fixed | Pre-2026-04 |
| 003 | Missing FAQ/Testimonials/Booking sections | ✅ Fixed | Pre-2026-04 |
| 004 | Smoke test passes `/template` iframe as valid | ✅ Fixed | Pre-2026-04 |
| 005 | SuperSaas sub-account creation crash (missing DB columns) | ✅ Fixed | Pre-2026-04 |
| 006 | SuperSaas shows master account instead of client sub-account | ✅ Fixed | Pre-2026-04 |
| 007 | TypeScript errors from Edit tool truncation | ✅ Fixed | Pre-2026-04 |
| 008 | Nav links point to wrong sections | ✅ Fixed | Pre-2026-04 |
| 009 | Beehiiv newsletter 400 error | ✅ Fixed | Pre-2026-04 |
| 010 | "Book Now" buttons not scrolling to booking | ✅ Fixed | Pre-2026-04 |
| 011 | Stitch ignores structural HTML requirements | ✅ Fixed | Pre-2026-04 |
| 012 | gemini.ts TypeScript errors from single quotes in template literal | ✅ Fixed | Pre-2026-04 |
| 013 | Stitch generates structurally broken HTML → Step 4b added | ✅ Fixed | Pre-2026-04 |
| 014 | Step 4b cost/speed/context/fallback risks | ✅ Fixed | Pre-2026-04 |
| 015 | SuperSaas sub-user creation 400 Bad Request | ✅ Fixed | 2026-04 |
| 016 | SuperSaas schedule creation impossible via API | ✅ Fixed | 2026-04 |
| 017 | Multi-page: step 4b Claude destroyed page-switching structure | ✅ Fixed | 2026-05-02 |
| 018 | Multi-page: Stitch's .active CSS overridden by inline styles | ✅ Fixed | 2026-05-02 |
| 019 | Stitch incomplete multi-page: 1 page, no nav, missing sections | ✅ Fixed | 2026-05-03 |

---

## ISSUE 001 — Booking iframe shows "Initializing Calendar..." (SuperSaas template)
**Date:** Pre-2026-04
**Symptom:** Booking section shows SuperSaas loading spinner — real client schedule never loads.
**Root cause:** Step 6c strip regex only matched iframes with closing `</iframe>` tag. Self-closing iframes survived. Smoke test also passed `/template` URLs as valid.
**Fix:** Broadened strip regex to catch self-closing iframes + second pass for remaining `/template` iframes. Smoke test now explicitly rejects `/template` URLs.
**Status:** ✅ Fixed

---

## ISSUE 002 — Hamburger button not wired (mobile nav broken)
**Date:** Pre-2026-04
**Symptom:** Tapping mobile menu icon does nothing.
**Root cause (A):** Auditor's hamburger regex missed `data-icon="menu"` buttons with no aria-label. **(B):** No mobile drawer element in some Stitch outputs.
**Fix:** `auditor.ts` 3-strategy fix (class/aria-label, data-icon, md:hidden). `injectEssentials` detects missing drawer and injects one from existing nav links.
**Status:** ✅ Fixed

---

## ISSUE 003 — Missing sections (FAQ, Testimonials, Booking) in final output
**Date:** Pre-2026-04
**Symptom:** No `id="faq"`, `id="testimonials"`, or `id="booking"` in output.
**Root cause:** Stitch doesn't generate them reliably.
**Fix:** Step 6c fallback injects booking before `</body>`. Auditor injects FAQ + testimonials.
**Status:** ✅ Fixed

---

## ISSUE 004 — Smoke test passes `/template` iframe as valid booking
**Date:** Pre-2026-04
**Symptom:** Smoke shows "Booking iframe ✅" but site still shows "Initializing Calendar..."
**Root cause:** Smoke check was `liveHtml.includes("supersaas.com")` — template URL contains that string.
**Fix:** Smoke check now explicitly rejects URLs containing `/template`.
**Status:** ✅ Fixed

---

## ISSUE 005 — SuperSaas sub-account creation crash (missing DB columns)
**Date:** Pre-2026-04
**Symptom:** `INTAKE FAILED: saveJob failed: Could not find the 'supersaas_id' column`
**Root cause:** Supabase `jobs` table missing columns: `supersaas_id`, `supersaas_url`, `tawkto_property_id`, `metadata`.
**Fix:** Run `supabase-migration-run-now.sql` in Supabase SQL Editor.
**Status:** ✅ Fixed — migration must be run manually

---

## ISSUE 006 — SuperSaas shows master account instead of client sub-account
**Date:** Pre-2026-04
**Symptom:** Client portal booking tab shows all clients' bookings, not just their own.
**Root cause:** No sub-user created — all clients shared master account view.
**Fix:** `supersaas.ts` creates sub-user with `role: 3`, SSO embed URL `?user=email&password=xxx`, credentials in `job.metadata`.
**Status:** ✅ Fixed

---

## ISSUE 007 — TypeScript errors from Edit tool truncating large files
**Date:** Pre-2026-04
**Symptom:** `npx tsc --noEmit` reports unterminated template literals, missing braces across multiple files.
**Root cause:** Edit tool truncates large files mid-expression.
**Fix:** Restored from git HEAD, reapplied changes via Python atomic writes.
**Rule:** Files >80 lines must use Python atomic writes — never Edit tool directly.
**Status:** ✅ Fixed

---

## ISSUE 008 — Nav links point to wrong sections
**Date:** Pre-2026-04
**Symptom:** Clicking "Booking" in nav scrolls to top instead of booking section.
**Root cause:** Stitch generates `navigateTo('home')` for all nav items regardless of label.
**Fix:** `fixNavigateToTargets()` compile-time pass rewrites `navigateTo` targets based on link text. Runtime fix also in `injectEssentials`.
**Status:** ✅ Fixed

---

## ISSUE 009 — Beehiiv newsletter subscription 400 error
**Date:** Pre-2026-04
**Symptom:** Newsletter form returns 400. Logs: `Beehiiv API error 400`.
**Root cause:** Publication ID missing required `pub_` prefix.
**Fix:** `lib/beehiiv.ts` auto-prefixes `pub_` if not present.
**Status:** ✅ Fixed

---

## ISSUE 010 — "Book Now" / CTA buttons not scrolling to booking
**Date:** Pre-2026-04
**Symptom:** Hero CTA buttons do nothing on click.
**Root cause:** Stitch generates buttons with no `onclick` handler.
**Fix:** `injectEssentials` wires all buttons with text "book", "appointment", "reserve" to `navigateTo('booking')`.
**Status:** ✅ Fixed

---

## ISSUE 011 — Stitch ignores structural HTML requirements
**Date:** Pre-2026-04
**Symptom:** Raw Stitch output missing required IDs, mobile drawer, sections even with explicit prompt.
**Root cause:** Stitch is a visual design tool — ignores functional/structural HTML requirements.
**Fix:** Prompt uses plain `id=hamburger` notation. Core strategy: post-processing (auditor + injectEssentials + step6c) is source of truth for structure.
**Status:** ✅ Fixed

---

## ISSUE 012 — gemini.ts TypeScript errors from single quotes in template literal
**Date:** Pre-2026-04
**Symptom:** `npx tsc` reports dozens of errors in `lib/gemini.ts` after prompt update.
**Root cause:** Single quotes inside backtick template literal break TypeScript's parser.
**Fix:** Replaced all `'quoted'` HTML attribute examples with unquoted notation.
**Rule:** Never use single quotes inside template literals in prompt strings.
**Status:** ✅ Fixed

---

## ISSUE 013 — Step 4b added: Claude rebuilds Stitch HTML to guarantee structure
**Date:** Pre-2026-04
**Symptom:** All structural IDs missing even after prompt improvements.
**Root cause:** Stitch reliably ignores functional requirements. No prompt can fix this.
**Fix:** Step 4b passes Stitch CSS + body to Claude Haiku which rewrites full HTML guaranteeing all structural IDs. Falls back to raw Stitch HTML if output invalid. Alert email on fallback.
**Status:** ✅ Implemented (single-page only after Issue 017)

---

## ISSUE 014 — Step 4b risks (cost, speed, context, silent fallback)
**Date:** Pre-2026-04
**Fix:** Switched to `claude-haiku-4-5` (~20x cheaper). Speed tradeoff accepted. Full body up to 16k chars. Fallback sends alert email with job ID.
**Status:** ✅ All four resolved

---

## ISSUE 015 — SuperSaas sub-user creation failing with 400 Bad Request
**Date:** 2026-04
**Symptom:** `[SuperSaas] Sub-user creation failed (non-fatal): SuperSaas API 400`
**Root cause:** `role: "user"` (string) must be `role: 3` (integer). `name` must be login email not business name. `schedules` field needs numeric ID not name string. Free plan blocks Users API.
**Fix:** `role: 3`, `name: clientEmail`, `full_name: businessName`, `actualName` hardcoded to `slugName`, 3-strategy creation (with schedules ID → without → look up existing by email). `SUPERSAAS_OWNER_EMAIL` env var skips for master account.
**Env var:** `SUPERSAAS_OWNER_EMAIL=hello@webgecko.au`
**Status:** ✅ Fixed

---

## ISSUE 016 — SuperSaas schedule creation impossible via API
**Date:** 2026-04
**Symptom:** Every build returns HTTP 200 with existing template schedule — new schedule never created.
**Root cause:** SuperSaas Information API is GET-only. `POST /api/schedules` doesn't exist.
**Fix:** Dropped programmatic schedule creation. Admin email includes manual checklist. Admin dashboard has 7-item checklist + "Activate & Launch" button. Payment webhook no longer auto-triggers build.
**Status:** ✅ Fixed — schedule creation is manual

---

## ISSUE 017 — Multi-page: step 4b Claude destroyed page-switching structure
**Date:** 2026-05-02
**Symptom:** All nav buttons broken on multi-page builds. Single-page works fine.
**Root cause:** Step 4b prompt listed single-page requirements (`<section id="hero">` etc.) — Claude rebuilt as scroll layout, overwriting Stitch's correct `<div class="page-section" id="home">` page-switching divs. Auditor also injected sections incorrectly.
**Fix:** Step 4b skips for valid multi-page Stitch output. Auditor skips faq/testimonials/contact checks for valid multi-page. `navigateTo` + init detect both `[data-page]` and `.page-section[id]` patterns.
**Status:** ✅ Fixed

---

## ISSUE 018 — Multi-page: Stitch's .active CSS overridden by inline styles
**Date:** 2026-05-02
**Symptom:** After Issue 017 fix, multi-page nav still completely broken.
**Root cause:** Step 5 stripped Stitch's `navigateTo` + `toggleDrawer` script. Our replacement used `style.display = "none/block"` inline — but Stitch CSS uses `.page-section { display:none }` / `.page-section.active { display:block }`. Inline styles override CSS permanently.
**Fix:** Step 5 script-stripping wrapped in `if (!isMultiPage)`. `injectEssentials` `navigateTo` guarded with `if (!window.navigateTo)`. Thin wrapper closes mobile drawer then delegates to original. Multi-page init only manages `.active` class, never inline styles.
**Status:** ✅ Fixed

---

## ISSUE 019 — Stitch incomplete multi-page: only 1 page, no nav calls, missing sections
**Date:** 2026-05-03
**Symptom:** Checklist shows testimonials, FAQ, contact, real email all failing. Buttons don't work. Site uses Claude's generic UI, not Stitch's design.
**Root cause (A):** Stitch generated only 1 `page-section` div with no `navigateTo()` calls — pipeline treated it as valid multi-page and skipped step 4b entirely.
**Root cause (B):** Auditor `isMultiPage` guard (Issue 017) skipped injecting faq/testimonials/contact even with none present — `isMultiPage` was true regardless of Stitch output quality.
**Root cause (C):** When Claude rebuild ran for multi-page jobs, requirements list still listed single-page sections instead of multi-page page divs.
**Fix:** Step 4b now validates before skipping: requires `pageSectionCount >= 2` AND `navCallCount >= 2`. Auditor uses same `isValidMultiPage` check. Step 4b requirements list is dynamic — multi-page path instructs Claude to build `<div class="page-section">` pages with `navigateTo()` + `toggleDrawer()` + CSS; single-page uses scroll sections.
**Status:** ✅ Fixed — deploy and rebuild

---

## ISSUE 020 — Multi-page nav buttons broken + rebuild produces completely different site
**Date:** 2026-05-03
**Symptom (A):** Nav buttons on multi-page sites don't switch pages at all — clicking does nothing.
**Symptom (B):** Triggering a rebuild via "🔄 Rebuild Site" produces a visually completely different site with new layout/colours.
**Root cause (A) — Three competing navigateTo definitions racing each other:**
  1. `injectEssentials` conditionally defined `navigateTo` only if `!window.navigateTo` — so if Stitch's version existed it was kept, even if broken
  2. A wrapper IIFE then captured `_orig = window.navigateTo` at execution time — if Stitch's script tag appeared *after* the injected script in the HTML, `_orig` was `undefined` at capture time
  3. The wrapper called `_orig(pageId)` — with `_orig = undefined`, navigation silently did nothing
  4. Additionally Step 5 had `if (!isMultiPage)` guard on Stitch script stripping — so Stitch's broken/conflicting `navigateTo` was kept intact for multi-page builds
**Root cause (B) — Rebuild re-runs entire pipeline including Stitch generation:**
  - `/api/pipeline/run` fired `inngest.send("build/website")` with no flags
  - Pipeline ran Steps 0–4b: Stitch generated a brand-new design, Claude rebuilt that new output
  - No mechanism existed to reuse the saved HTML from the first build
**Fix (A) — Single authoritative navigateTo:**
  - Removed `if (!window.navigateTo)` guard and IIFE wrapper entirely
  - `injectEssentials` now always defines `window.navigateTo` unconditionally
  - New implementation detects multi-page vs single-page at runtime: `querySelectorAll(".page-section").length > 1` → toggle `.active` class; else → `scrollIntoView`
  - Clears inline `display` style on activated section (Claude sometimes bakes in `style="display:none"` which blocks CSS)
  - Multi-page init now always removes `.active` from all sections then adds it to first, and injects a `<style data-wg-mp>` CSS guarantee block if missing
  - Step 5 strips Stitch's `navigateTo` and `showPage` scripts unconditionally (removed `if (!isMultiPage)` guard)
  - Step 5 `showPage()` replacement now runs for all site types, not just multi-page
  - Claude rebuild prompt updated: tells Claude to include required CSS + NOT define `navigateTo()` (it will be injected)
  - FailLoop re-injection updated to use `.active` class toggling instead of `style.display`
**Fix (B) — Rebuild reuses saved HTML:**
  - `/api/pipeline/run` now sends `isRebuild: true` in Inngest event data
  - Pipeline reads `isRebuild` and sets `savedHtmlForRebuild = job.html` if saved HTML exists (>5000 chars)
  - Steps 0–4b all short-circuit when `savedHtmlForRebuild` is set: SuperSaas reuses `job.supersaasUrl`, blueprint returns cached dummy, Stitch steps return `"rebuild-skipped"`, step 4b returns saved HTML directly
  - Steps 5–10 (inject, audit, deploy, smoke, save) run normally on the saved HTML → incremental fixes only
**Files changed:** `lib/pipeline-helpers.ts`, `app/api/inngest/route.ts`, `app/api/pipeline/run/route.ts`
**Status:** ✅ Fixed
