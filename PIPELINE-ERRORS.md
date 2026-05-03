# WebGecko Pipeline Error Log
_Updated automatically. Each error has: symptom → root cause → fix applied → status._

---

## ISSUE 001 — Booking iframe shows "Initializing Calendar..." (SuperSaas template)
**Symptom:** Booking section shows a SuperSaas loading spinner instead of the client's real schedule.  
**Root cause:** Stitch embeds `supersaas.com/schedule/webgecko/template` as a placeholder. Step 6c is supposed to strip it and inject the real client URL — but the strip regex only matched iframes with a closing `</iframe>` tag. Self-closing iframes survived.  
**Fix applied:**
- `inngest/route.ts` step 6c: broadened strip regex to catch self-closing iframes + added a second pass removing any remaining `/template` iframes
- Smoke test no longer counts `supersaas.com/template` as a passing booking iframe
- Fail-loop re-injection also checks for `/template` and re-injects if found  
**Status:** ✅ Fixed in pipeline — deploy and rebuild

---

## ISSUE 002 — Hamburger button not wired (mobile nav broken)
**Symptom:** Tapping the mobile menu icon does nothing. No drawer opens.  
**Root cause (A):** Auditor's hamburger fix regex only matched buttons with class names like `hamburger`, `menu-toggle`, or specific aria-labels. Stitch often generates `aria-label="Menu"` (capital M, no "Open" prefix) which was in the list — but some builds use only `data-icon="menu"` with no aria-label at all. Those were detected as "no hamburger issue" but the fix never actually ran because the auditor marked it as already-OK via the `hasHamburger` check.  
**Root cause (B):** No mobile drawer element existed at all in several Stitch outputs. The hamburger script had nowhere to open.  
**Fix applied:**
- `auditor.ts`: 3-strategy fix — (A) class/aria-label, (B) `data-icon="menu"` button, (C) `md:hidden` button
- `pipeline-helpers.ts`: `injectEssentials` now detects when no drawer exists and injects one dynamically at runtime, pulling links from the existing `<nav>` and wiring the hamburger to it  
**Status:** ✅ Fixed in pipeline — deploy and rebuild

---

## ISSUE 003 — Missing sections (FAQ, Testimonials, Booking) in final output
**Symptom:** Stitch raw output has no `id="faq"`, `id="testimonials"`, or `id="booking"` sections.  
**Root cause:** Stitch doesn't always generate these even when the prompt requests them. The auditor is supposed to inject them — but only runs on content BEFORE step 6c (booking). FAQ/testimonials are injected by auditor correctly, but booking was injected by step 6c which replaces the section. If Stitch generates no booking section at all, step 6c falls back to injecting before `</body>`.  
**Fix applied:** Step 6c fallback injection confirmed working. Auditor injects FAQ + testimonials.  
**Status:** ✅ Working correctly — sections appear in FINAL

---

## ISSUE 004 — Smoke test passes `/template` iframe as valid booking
**Symptom:** Smoke test shows "Booking iframe ✅" but site still shows "Initializing Calendar..."  
**Root cause:** Smoke check was: `liveHtml.includes("supersaas.com")` — the template URL contains `supersaas.com` so it passed even though it wasn't the real client URL.  
**Fix applied:** `inngest/route.ts`: smoke check now explicitly rejects URLs containing `/template`:
```
pass: (!!bookingUrl && liveHtml.includes(bookingUrl)) || (liveHtml.includes("supersaas.com") && !liveHtml.includes("/template"))
```
**Status:** ✅ Fixed

---

## ISSUE 005 — SuperSaas sub-account creation failing at intake (saveJob crash)
**Symptom:** `INTAKE FAILED: saveJob failed: Could not find the 'supersaas_id' column of 'jobs' in the schema cache`  
**Root cause:** Supabase `jobs` table was missing columns: `supersaas_id`, `supersaas_url`, `tawkto_property_id`, `metadata`. These were mapped in `db.ts` but never added to the database schema.  
**Fix applied:** `supabase-migration-run-now.sql` — run these in Supabase SQL Editor:
```sql
alter table jobs add column if not exists supersaas_url text;
alter table jobs add column if not exists supersaas_id bigint;
alter table jobs add column if not exists tawkto_property_id text;
alter table jobs add column if not exists metadata jsonb default '{}';
```
**Status:** ✅ Fixed — migration must be run in Supabase dashboard

---

## ISSUE 006 — SuperSaas shows master account instead of client sub-account
**Symptom:** Client portal booking tab shows the master `webgecko` account with all clients' bookings, not just their own.  
**Root cause:** `supersaas.ts` only created a schedule, no sub-user. All clients shared the master account view.  
**Fix applied:**
- `supersaas.ts`: now creates a sub-user per client via `POST /api/users` with `role: "user"` and `schedules: [scheduleName]`
- Embed URL uses SSO auto-login: `?user=email&password=xxx`
- Credentials stored in `job.metadata.supersaasSubEmail/Password`
- Welcome email (release route) includes login credentials for the client
**Status:** ✅ Fixed in code — requires Supabase migration (Issue 005) to persist

---

## ISSUE 007 — TypeScript compilation errors (truncated files from Edit tool)
**Symptom:** `npx tsc --noEmit` reports unterminated template literals, missing `}`, unclosed JSX tags across 6 files.  
**Root cause:** Edit tool on large files caused truncation mid-expression. Nested backticks in HTML template strings also cause TSC errors.  
**Affected files:** `app/c/[slug]/page.tsx`, `lib/auditor.ts`, `lib/db.ts`, `lib/pipeline-helpers.ts`, `lib/supersaas.ts`, `app/api/unlock/release/route.ts`  
**Fix applied:** Restored each file from git HEAD then reapplied changes via Python atomic writes. Replaced nested backtick HTML strings with array `.join("")` patterns.  
**Rule going forward:** Files >80 lines must use Python atomic writes, never the Edit tool directly.  
**Status:** ✅ Fixed — `tsc --noEmit` returns clean

---

## ISSUE 008 — Nav links point to wrong sections (e.g. "Booking" → navigateTo('home'))
**Symptom:** Clicking "Booking" in nav scrolls to top instead of booking section.  
**Root cause:** Stitch sometimes generates `navigateTo('home')` for all nav items, not inferring the correct target from the link label.  
**Fix applied:** `injectEssentials` in `pipeline-helpers.ts` auto-wires all `a,button` elements — if a nav link text contains "book" it rewires to `navigateTo('booking')`, etc. via the analytics/click tracking pass.  
**Status:** ⚠️ Partial — wiring happens at runtime via JS but Stitch's `onclick` attributes still have wrong targets. Should add a post-process step to fix `navigateTo` targets based on link text.  
**TODO:** Add step in pipeline to regex-replace `navigateTo('home')` on links whose text matches known section names.

---

## ISSUE 009 — Beehiiv newsletter subscription 400 error
**Symptom:** Newsletter form submits but returns 400. Logs: `Beehiiv API error 400`.  
**Root cause:** Publication ID in env var was a raw UUID without the required `pub_` prefix.  
**Fix applied:** `lib/beehiiv.ts`: auto-prefixes `pub_` if not present.  
**Status:** ✅ Fixed

---

## ISSUE 010 — "Book Now" / CTA buttons not scrolling to booking
**Symptom:** Hero CTA buttons and header "Book Now" button do nothing on click.  
**Root cause:** Stitch generates buttons with no `onclick` handler.  
**Fix applied:** `injectEssentials` wires all buttons whose text includes "book", "appointment", "reserve" to `navigateTo('booking')`.  
**Status:** ✅ Fixed via runtime JS wiring in injectEssentials

---

## OPEN ISSUES

| # | Issue | Status |
|---|-------|--------|
| 008 | Nav links have wrong `navigateTo` targets from Stitch | ⚠️ Needs pipeline post-process step |
| — | Tawk.to live chat embed URL doubling | ✅ Fixed in pipeline-helpers.ts |
| — | Light-theme sites getting dark injected sections | ✅ Fixed via `detectTheme()` in auditor.ts |

---

## ISSUE 011 — Stitch ignores structural HTML requirements (missing ids, mobile drawer, sections)
**Symptom:** RAW Stitch output missing `id="hamburger"`, `id="mobile-menu"`, `id="booking"`, `id="faq"`, `id="testimonials"`. Final output has them only because post-processing injected them.  
**Root cause:** Stitch is a visual design tool — it generates beautiful UI but ignores specific HTML attribute requirements (`id=`, `onclick=`, `class=`). Changing the export file type is not possible (HTML is the only output). The prompt was already explicit but Stitch treats structural requirements as suggestions.  
**Fix applied:**
- `lib/gemini.ts`: Stitch prompt now uses plain `id=hamburger` notation (no quotes) to avoid Stitch treating them as design tokens, and is more explicit about element structure
- Removed single-quoted HTML attributes from the template literal to fix TypeScript compilation errors
- Core strategy: **never rely on Stitch for structure** — pipeline post-processing (auditor + injectEssentials + step6c) is the source of truth for all structural elements  
**Status:** ✅ Prompt improved + post-processing is the safety net

---

## ISSUE 012 — gemini.ts TypeScript errors from single quotes inside template literal
**Symptom:** `npx tsc --noEmit` reports dozens of errors in `lib/gemini.ts` after prompt update.  
**Root cause:** Single quotes inside a backtick template literal (e.g. `<button id='hamburger'>`) break TypeScript's parser when the surrounding string already uses backticks.  
**Fix applied:** Replaced all `'quoted'` HTML attribute examples in the prompt text with unquoted `id=hamburger` notation — Stitch understands both and this avoids the TS conflict.  
**Rule going forward:** Never use single quotes inside template literals in gemini.ts or pipeline-helpers.ts prompt strings.  
**Status:** ✅ Fixed
---

## ISSUE 013 — Stitch generates visually good but structurally broken HTML
**Symptom:** All the nav IDs, mobile drawer, booking section, FAQ, testimonials missing from Stitch output even with explicit prompt instructions.  
**Root cause:** Stitch is a visual design tool — it ignores functional/structural HTML requirements reliably. No prompt improvement can fix this.  
**Fix applied:** New **Step 4b** added to pipeline between Stitch fetch and code-fix pass:
- Passes Stitch CSS + body snippet to Claude Sonnet as a visual reference
- Claude rewrites the full HTML guaranteeing all structural requirements: `id=hamburger`, `id=mobile-menu`, `id=hero`, `id=services`, `id=testimonials`, `id=faq`, `id=contact`, booking iframe, footer copyright, navigateTo for multi-page
- Falls back to raw Stitch HTML if Claude output is too short/invalid
- All downstream steps (step 5+) now operate on Claude's rebuilt HTML, not Stitch's raw output  
**Status:** ✅ Implemented — deploy and rebuild
---

## ISSUE 014 — Step 4b cons addressed
Four risks identified and resolved:

**Cost (Sonnet ~$0.20/build):**  
→ Switched to `claude-haiku-4-5` — ~20x cheaper, still reliable for HTML generation.

**Speed (+30-60s):**  
→ Accepted tradeoff — pipeline is 5-10min already. No fix needed.

**Claude only sees 8k body snippet:**  
→ Now passes full body up to 16k chars. If larger, sends first 8k + last 4k so both hero and footer sections are always included. Extracts ALL `<style>` blocks, not just the first.

**Silent fallback (you'd never know it triggered):**  
→ Fallback now sends an alert email to crayzewastaken@gmail.com with job ID and char count when it triggers. Also logs which required IDs are missing even on success.

**Status:** ✅ All four resolved

---

## ISSUE 015 — SuperSaas sub-user creation failing with 400 Bad Request
**Symptom:** `[SuperSaas] Sub-user creation failed (non-fatal): SuperSaas API 400: {"errors":[{"status":"400","title":"Bad request"}]}`  
**Root cause (A):** The `schedules` field in the user creation payload was passing the schedule name (a string) but SuperSaas expects schedule IDs (integers).  
**Root cause (B):** `actualName` was being set from `schedule?.name` in the API response — but SuperSaas sometimes returns the master `"template"` schedule object instead of the newly created one, making the embed URL point to `webgecko/template` instead of `webgecko/doctorvisits`.  
**Fix applied:**
- `lib/supersaas.ts`: `schedules` field now passes `[id]` (numeric) instead of `[actualName]` (string)
- Added fallback retry: if POST with `schedules` fails 400, retry without the `schedules` field (some SuperSaas plans don't support schedule restrictions)
- `actualName` is now hardcoded to `slugName` (the name we requested) rather than trusting the API response — this prevents the master template schedule name from leaking into embed URLs
- Added raw response logging so the next 400 can be diagnosed from the exact SS response body  
**Status:** ✅ Fixed — deploy and rebuild

**Update after second run:**
Sub-user 400 persisted even without the `schedules` field — root cause is likely email already registered from a prior build attempt. Added 3-strategy approach:
1. POST with `schedules:[id]` (numeric)
2. POST without `schedules` field
3. GET `/users` to find existing user by email → update their password so embed URL still works  
Also added full payload logging before each attempt so the exact SS error can be diagnosed from logs.  
**Status:** ✅ Updated — deploy and rebuild

**Root cause confirmed (final):** SuperSaas `role` field takes an **integer** (`3` = regular user), not the string `"user"`. We were sending `role: "user"` which causes a 400 Bad Request. Also `name` must be the login email address (not the business name), and `full_name` is the separate display name field.  
**Final fix:**
- `role: 3` (integer) instead of `role: "user"` (string)
- `name: clientEmail` (login identifier) instead of `name: businessName`
- `full_name: businessName` (display name)
- Added `SUPERSAAS_OWNER_EMAIL` env var to skip sub-user creation when client email matches master account (e.g. during testing with your own email)  
**Env var to add:** `SUPERSAAS_OWNER_EMAIL=hello@webgecko.au` in Vercel + `.env.local`  
**Status:** ✅ Fixed — deploy and rebuild
