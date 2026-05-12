# WebGecko — Full Session Handoff Summary

**Date:** 2026-05-12  
**Repo:** `github.com/Crayzewastaken/webgecko-builder` (branch: `main`)  
**Stack:** Next.js 16 App Router (TypeScript), Inngest background jobs, Supabase, Vercel, Stripe Connect, SuperSaas, Beehiiv, Tawk.to, Termly  
**Workspace:** `C:\Users\zackr\webgecko`

---

## 1. What WebGecko Is

WebGecko is a white-label website-as-a-service SaaS built for a single operator (Zack). Clients fill out an intake form, pay a deposit, and the system automatically builds and deploys a fully styled multi-page or single-page website using Claude/Gemini (via a "Stitch" prompt chain), then deploys it to Vercel under a stable alias URL. The operator manages all clients through a single admin dashboard.

### Key flows

1. **Intake form** (`app/page.tsx`) → client submits business details, feature choices, style preferences → submitted to `/api/secure-submit` → creates a job in Supabase → triggers Inngest pipeline
2. **Inngest pipeline** (`app/api/inngest/route.ts`, ~2,200 lines) → 10+ steps: blueprint → Stitch HTML generation → feature injection (newsletter, FAQ, testimonials, booking, shop) → auditor fixes → deploy to Vercel → smoke test
3. **Admin dashboard** (`app/admin/page.tsx`, ~3,000 lines) → operator views all clients, manages pipeline, checklist, integrations, content, payments, analytics
4. **Client portal** (`app/c/[slug]/page.tsx`) → client sees build status, provides missing details (ABN, domain, address, GA4), manages bookings, requests features, views content

---

## 2. Architecture

### Directories

```
app/
  page.tsx                  — Intake/signup form (multi-step wizard)
  admin/
    page.tsx                — Admin dashboard (3,000-line single component, ~40 useState hooks, 12 tab panels)
    login/page.tsx          — Admin login
    history/page.tsx        — Pipeline error/history log viewer
  c/[slug]/page.tsx         — Client portal (authenticated via wg_client_slug cookie)
  client/[slug]/page.tsx    — Alternate client portal path
  api/
    inngest/route.ts        — Inngest background job handler (the entire pipeline, Steps 0–10)
    secure-submit/route.ts  — Intake form submission endpoint
    admin/
      clients/              — List all clients
      redeploy/             — Force redeploy (returns stable alias URL)
      fix-proxy/            — Fix/patch existing deploy (returns stable alias URL)
      checklist-links/      — Store checklist URL inputs (Termly, ToS, GA4) per job
      content/              — Blog/newsletter/review/deal/product CRUD
      update-integration/   — Save GA4 ID, custom domain, booking URL, etc.
      assign-domain/        — Wire custom domain to Vercel project
      ... (20+ other admin routes)
    client-login/route.ts   — Client auth GET (cookie) + PATCH (update ABN/domain/address/ga4Id)
    stripe/
      connect/route.ts      — Start Stripe Connect OAuth (includes HMAC CSRF state)
      callback/route.ts     — Stripe Connect OAuth callback (verifies HMAC state)
      webhook/route.ts      — Stripe payment webhooks
    preview/proxy/route.ts  — Authenticated proxy for preview HTML
    unlock/release/route.ts — Mark site as released to client
    ... (60+ API routes total)

lib/
  auditor.ts               — Post-generation HTML auditor: fixes phones, injects missing sections (FAQ, testimonials, legal), multi-page aware
  pipeline-helpers.ts      — validateForDeploy, ensureMultiPageStructure, repairHtml, addSectionIdSmart, fallback page content templates
  stitch.ts                — Stitch HTML generation (Claude/Gemini prompt chain)
  blueprint.ts             — Step 1: generate colour palette, typography, design tokens
  promptBuilder.ts         — Builds the massive Stitch system prompt from job data
  db.ts                    — Supabase helpers, camelCase↔snake_case conversion
  admin-auth.ts            — isAdminAuthedLegacy(): cookie session OR ?secret=PROCESS_SECRET
  deploySite.ts            — Vercel deploy API wrapper
  stripe-connect.ts        — Stripe Connect helpers
  supersaas.ts             — SuperSaas booking API
  beehiiv.ts               — Beehiiv newsletter API
  tawkto.ts                — Tawk.to live chat API
  inngest.ts               — Inngest client setup
```

### Database (Supabase)

Two main tables:
- **`clients`** — slug, business_name, email, phone, abn, ga4_id, domain, preview_url, live_url, build_status, payment state, metadata (JSONB)
- **`jobs`** — id, user_input (JSONB with all intake fields), metadata (JSONB), pipeline_log (JSONB array), build_status, html (full HTML output)

`lib/db.ts` handles camelCase↔snake_case conversion. The `user_input` JSONB on jobs stores all intake form fields including abn, businessAddress, preferredDomain, ga4Id.

### Auth

- **Admin:** HttpOnly cookie `wg_admin_session` (scrypt-hashed password) OR `?secret=PROCESS_SECRET` query param. `isAdminAuthedLegacy()` in `lib/admin-auth.ts` checks both.
- **Client:** HttpOnly cookie `wg_client_slug` set on login. Client portal reads this to gate access.

### Deployment

- All client sites deploy to Vercel as separate projects named `wg-{slug}`
- **Always use stable alias** `https://wg-{slug}.vercel.app` — NOT the per-deploy unique hash URL (those go stale after ~30 days and cause false smoke test failures)
- `redeploy` and `fix-proxy` routes were fixed to always return and save the stable alias

---

## 3. Pipeline Steps (Inngest)

Located in `app/api/inngest/route.ts`. Each step is a `step.run()` call:

| Step | Name | Description |
|------|------|-------------|
| 0 | trigger | Receive job, validate, set building status |
| 1 | blueprint | Generate colour palette, fonts, design tokens via Claude |
| 2 | stitch | Generate full HTML via Claude/Gemini Stitch prompt |
| 3 | (parse) | Extract HTML from Stitch response |
| 4 | features | Inject features: newsletter, FAQ, testimonials, booking iframe, live chat |
| 4b | ensurePages | Run ensureMultiPageStructure to guarantee all requested data-page wrappers exist |
| 5 | auditor | Fix placeholder phones, inject missing section IDs, inject legal pages, strip markdown asterisks |
| 6 | tawkto | Create Tawk.to property for live chat (skipped if API 404s) |
| 7 | shop | Inject shop section if hasShop |
| 7b | validate | validateForDeploy — structural checks, page content checks, then repair if needed |
| 8 | deploy | Deploy HTML to Vercel, save stable alias URL |
| 9 | smoketest | Fetch stable alias with 3s/6s/9s delays (3 attempts), check content |
| 10 | notify | Send email to client, update build status |

### Critical pipeline bugs fixed this session

**Newsletter/FAQ/testimonials injection on every page (multi-page sites)**  
Previously injected before `<footer>` globally — appeared on booking, about, contact pages too. Fixed in Step 4: now injects inside `<div data-page="home">` wrapper only. Single-page sites still use footer-based injection.

**Smoke test false failures**  
Was hitting per-deploy unique hash URL with 2s/4s/6s delays. Cold starts take 10–15s. Fixed to use stable alias URL with 3s/6s/9s delays.

**Live domain showing stale content**  
`redeploy` and `fix-proxy` were saving the unique hash URL as `previewUrl`. Fixed to always save `https://wg-{slug}.vercel.app`.

---

## 4. Security Fixes (Restored from NTFS Truncation)

Three files were truncated by the Edit tool's NTFS bug (large files get truncated mid-byte). All were restored via Python write-back:

**`app/api/stripe/callback/route.ts`**  
Full HMAC CSRF verification using `crypto.createHmac('sha256', PROCESS_SECRET)` and `timingSafeEqual`. Exports `generateStripeState(jobId)`. The connect route (`app/api/stripe/connect/route.ts`) was also fixed to include the state token in the return_url.

**`app/api/preview/proxy/route.ts`**  
Auth gate: requires admin session OR matching `wg_client_slug` cookie. Returns 401 otherwise.

**`app/api/client-login/route.ts`** (PATCH)  
Enhanced to accept: `shopPaymentUrl`, `abn`, `businessAddress`, `preferredDomain`, `ga4Id`. Each field is sanitised (ABN: digits/spaces only, 20 chars; address: 300 chars; domain: strip https://, 253 chars; ga4Id: 20 chars). Updates both `clients` table and `jobs.user_input` JSONB.

---

## 5. Admin Dashboard Changes (`app/admin/page.tsx`)

### Removed: To-Do tab
The "To-Do" tab was a duplicate of the Checklist tab. Removed entirely:
- `"todo"` removed from tab union type and tabs array
- `todoCompleted: Set<string>` state and localStorage persistence removed
- Entire To-Do tab content block (~7,700 chars) deleted

### Enhanced: Checklist tab

The checklist now has:

1. **"✓ Mark section complete" button** on every section header — marks all completable items in that section done in one click. Items requiring a URL input (Termly, GA4, ToS) stay locked until the URL is pasted. Once all done, button swaps to a "✓ Done" badge with item count.

2. **"Final Submit — Push Website Live" CTA** — large green button that appears only when all `required: true` pre-launch items are checked across all pre-launch sections. Calls `/api/unlock/release`. After release, swaps to a "Site is live ✅" banner.

3. **Pre-launch / Post-launch split:**
   - Pre-launch sections: Privacy Policy, Terms of Service, Legal Checks, Domain & Hosting, Newsletter (Beehiiv), Google Analytics (GA4), Stripe Shop Setup (conditional), Booking System (conditional), Pre-Launch Checks
   - Post-launch section (purple "Post-Launch" divider): Send go-live email, Mark job complete, Confirm monthly sub active, Monitor first 7 days, Request Google review
   - `Section` type updated to include optional `postLaunch?: boolean`
   - Pre-launch required gate: `preLaunchRequired = preLaunchSections.flatMap(s=>s.items).filter(i=>i.required)` — all must be `checklistDone[key] === true` before Go Live button appears

### Checklist section structure

```
1. Privacy Policy         (Termly — sign up, add site, generate, embed URL, cookie banner)
2. Terms of Service       (freeprivacypolicy.com — generate, embed URL)
3. Legal Checks           (ABN visible, SSL, copyright, spam law)
4. Domain & Hosting       (check domain, register VentraIP, DNS, Vercel, GSC)
5. Newsletter — Beehiiv   (conditional on Newsletter feature)
6. Google Analytics GA4   (conditional — create property, get G- ID, test)
7. Stripe Shop Setup      (conditional — connect OAuth, sync products, test)
8. Booking (SuperSaas)    (conditional — account, schedule, URL, notifications)
9. Pre-Launch Checks      (review site, policies, PageSpeed, Search Console) ← gates Go Live
── POST-LAUNCH divider ──
10. Post-Launch            (email client, mark complete, monthly sub, monitor, Google review)
```

---

## 6. Intake Form Changes (`app/page.tsx`)

### AI language removed
- Testimonials: "we'll use these instead of AI-generated ones. Leave blank and we'll create realistic placeholders." → "we'll write them for you"
- Blog topics: "Leave blank for AI-generated industry topics." → "we'll come up with relevant topics for your industry"

### ABN, domain, business address, GA4 made optional
Previously all four were required fields with blocking validation. Now:
- Removed from `validateStep()` — only checks ABN format if a value is provided
- Labels updated to "(optional)" with hints pointing to client dashboard
- Fields still appear in the form and are submitted if filled — they're just no longer blockers

Rationale: clients were dropping off at the contact step because they didn't have their ABN handy just to see the price.

---

## 7. Client Portal Changes (`app/c/[slug]/page.tsx`)

### Business details card reworked
Previously: shown only before deposit payment, blocked deposit button if ABN/domain/address missing.

Now:
- Shown whenever any of ABN, domain, or address is still missing — regardless of payment status
- Hidden automatically once all three are filled AND deposit is paid
- Deposit button no longer blocked — client can pay first, fill details later
- **GA4 field added** — client can drop in their G- ID at any time
- Missing fields highlighted in amber with "← needed" indicator
- Card title changes: "Before You Pay — A Few Details" (pre-payment) vs "A Few Details We Still Need" (post-payment)
- Save button always available, not disabled by missing fields

### State additions
```typescript
const [prePayGa4, setPrePayGa4] = useState("");
```
Loaded from `normalised.ga4Id || ui.ga4Id`, saved via PATCH to `/api/client-login`.

### ClientData interface
Added `ga4Id?: string` to the `ClientData` interface (was missing, caused Vercel build failure).

---

## 8. Pipeline Helpers / Validator Changes (`lib/pipeline-helpers.ts`)

### validateForDeploy — thin-page check fix

Old: strip all HTML tags from page wrapper, require ≥300 text chars. This fails for gallery pages which are image grids with almost no visible text.

New: visual pages (`gallery`, `portfolio`, `our-work`, `team`) are checked by raw HTML length (≥500 chars) instead of stripped text. All other pages still use the 300-char text threshold.

```typescript
const visualPages = new Set(["gallery", "portfolio", "our-work", "team"]);
// visual pages: raw HTML > 500 chars
// other pages: stripped text > 300 chars
```

### Fallback gallery content fattened

Two locations updated:
1. `FALLBACK_PAGE_CONTENT.gallery` in `ensureMultiPageStructure` — now includes heading, subtitle, 6 image cards with alt text, footer contact line. Passes both old and new thresholds.
2. Strategy D injection (`addSectionIdSmart`) — same treatment, includes full 6-card grid.

---

## 9. Auditor Changes (`lib/auditor.ts`)

### addSectionIdSmart — multi-page aware injection

For multi-page sites, fallback section injection (FAQ, testimonials, etc.) now targets the `data-page="home"` wrapper specifically:

```typescript
const homeWrapperRe = /(<[^>]+data-page=["']home["'][^>]*>)([\s\S]*?)(<\/(?:section|div)>...)/i;
// inject inside home wrapper, not globally before footer
```

For single-page sites: inject before `<footer>` or before `</body>` as before.

This prevents FAQ/testimonial sections from appearing on booking, about, contact, gallery pages.

---

## 10. Known Issues / Pending Items

### Git index.lock
The `.git/index.lock` file occasionally gets stuck (Linux sandbox leaves it behind). User must run in PowerShell before any git operation:
```powershell
Remove-Item -Force C:\Users\zackr\webgecko\.git\index.lock
```

### NTFS Edit tool truncation
Any `Edit` tool write to a file >~100KB on Windows/NTFS risks truncating the file mid-byte. Always use Python write-back for large files:
```python
with open("path/to/file.ts", "r", encoding="utf-8") as f:
    src = f.read()
src = src.replace(OLD, NEW)
with open("path/to/file.ts", "w", encoding="utf-8") as f:
    f.write(src)
```
The main files at risk: `app/api/inngest/route.ts` (~2,200 lines), `app/admin/page.tsx` (~3,000 lines), `app/c/[slug]/page.tsx` (~2,000 lines), `lib/pipeline-helpers.ts`.

### ui-history.json TSC error
`lib/ui-history.json` is malformed JSON (missing `]`). Pre-existing. TSC reports it but it doesn't affect the build — Next.js doesn't import it directly. Can be safely ignored or the file deleted.

### /api/client/content missing auth
Identified in the security audit as a critical issue — this endpoint has no authentication. Any request with a valid jobId can read/write client content. Needs an auth gate added.

### jobId collision risk
If two clients submit simultaneously with the same slug-derived jobId, data can be overwritten. No UUID collision prevention currently in place.

---

## 11. Audit Report

A comprehensive 50-finding audit report was generated and saved to:
`C:\Users\zackr\webgecko\WebGecko-Audit-Report.docx`

Categories: Security (12), Bugs (11), Architecture (10), Scalability (6), Performance (5), Missing Systems (10), UX (8), Documentation (6), Business Logic (7). Top priorities identified:
1. `/api/client/content` missing auth (Critical)
2. jobId collision risk (High)
3. Monolithic Inngest file (Architecture)
4. 3,000-line admin component (Architecture)

---

## 12. Environment Variables (Vercel)

Key env vars the pipeline depends on:
- `PROCESS_SECRET` — used for admin auth `?secret=` param and HMAC CSRF tokens
- `ADMIN_SESSION_SECRET` — HttpOnly cookie signing
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — database
- `ANTHROPIC_API_KEY` — Claude for Stitch/blueprint
- `GOOGLE_API_KEY` — Gemini fallback
- `VERCEL_TOKEN`, `VERCEL_TEAM_ID` — deploy API
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_CLIENT_ID` — Stripe Connect
- `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` — newsletter
- `RESEND_API_KEY` — transactional email
- `TAWK_API_KEY` — live chat property creation
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — Inngest background jobs
- `CLOUDFLARE_TURNSTILE_SECRET` — intake form bot protection

---

## 13. Commit History (This Session)

```
9e7c65a  fix: add ga4Id to ClientData interface
c3556cd  fix: gallery thin-page validation — use raw HTML length for visual pages, fatten fallback gallery content
55c74ec  checklist: remove todo tab, add section complete buttons + go-live CTA
2fd9a33  fix: multi-page feature injection, smoke test URL, and stale live domain links
```

Plus earlier commits in the session:
```
dbb4a1f  fixed seo button, action needed, build/payment/feature request issues
027da25  feat: simplified checklist - concise steps, GSC added to domain section
d27abbd  fix: google SA key private_key safely to handle literal newlines
f22f41e  feat: Google Indexing API - auto-submit custom domains on deploy
3a76822  feat: pre-payment ABN/domain/address form in client portal
```

---

## 14. How to Continue

When picking this up in a new session:

1. Read `CLAUDE.md` and `AGENTS.md` in the repo root — project-level instructions
2. The main files to understand are: `app/api/inngest/route.ts` (pipeline), `app/admin/page.tsx` (admin UI), `app/c/[slug]/page.tsx` (client portal), `lib/pipeline-helpers.ts` (validators), `lib/auditor.ts` (HTML fixer)
3. Always use Python write-back for files > 100KB (see section 10)
4. TSC check: `cd C:\Users\zackr\webgecko && npx tsc --noEmit` — ignore `ui-history.json` error
5. Git: clear index.lock first if needed, then `git add -A && git commit -m "..." && git push`
6. Stable alias for deployed client sites: `https://wg-{slug}.vercel.app` — never use the hash URL
7. Admin auth: cookie `wg_admin_session` OR `?secret=PROCESS_SECRET` query param
8. Client auth: cookie `wg_client_slug` must match the slug in the URL
