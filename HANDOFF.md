# WebGecko — Full Session Handoff Summary

**Last Updated:** 2026-05-13  
**Repo:** `github.com/Crayzewastaken/webgecko-builder` (branch: `main`)  
**Stack:** Next.js 16 App Router (TypeScript), Inngest background jobs, Supabase, Vercel, Stripe Connect, SuperSaas, Beehiiv, Tawk.to, Termly  
**Workspace:** `C:\Users\zackr\webgecko`  
**Vercel project:** `webgeckofl.vercel.app`

---

## 1. What WebGecko Is

WebGecko is a white-label website-as-a-service SaaS (single operator: Zack). Clients fill an intake form, pay a deposit, the system builds and deploys a fully styled multi-page or single-page website via Claude/Gemini ("Stitch"), deployed to Vercel under a stable alias. Operator manages all clients via a single admin dashboard.

### Key flows
1. Intake form (`app/page.tsx`) → `/api/secure-submit` → Supabase job → Inngest pipeline
2. Inngest pipeline (`app/api/inngest/route.ts`, ~2,200 lines) → 10+ steps: blueprint → Stitch HTML → feature injection → auditor fixes → deploy → smoke test
3. Admin dashboard (`app/admin/page.tsx`) → all clients, pipeline, checklist, integrations, payments
4. Client portal (`app/c/[slug]/page.tsx`) → build status, submit details, manage bookings, request features

---

## 2. Architecture

```
app/
  page.tsx                  — Intake form (multi-step wizard)
  admin/page.tsx            — Admin dashboard
  c/[slug]/page.tsx         — Client portal
  api/
    inngest/route.ts        — Full pipeline (Steps 0-10)
    unlock/release/route.ts — Mark released + email client
    ... (60+ routes)

lib/
  auditor.ts               — HTML auditor (fixes phones, injects missing sections, legal pages)
  pipeline-helpers.ts      — validateForDeploy, injectImages, fetchPexelsPhoto, ensureMultiPageStructure
  blueprint.ts             — Step 1: colour/font design tokens
  admin-auth.ts            — isAdminAuthedLegacy(): cookie OR ?secret=PROCESS_SECRET
  db.ts                    — Supabase camelCase<->snake_case helpers
  deploySite.ts            — Vercel deploy API wrapper
```

### Auth
- **Admin:** `isAdminAuthedLegacy(req)` — HttpOnly cookie `wg_admin_session` first, then `?secret=PROCESS_SECRET`. ALL admin routes must use this function.
- **Client:** HttpOnly cookie `wg_client_slug`

### Deployment
- Client sites: Vercel project `wg-{slug}`, stable alias `https://wg-{slug}.vercel.app`
- NEVER use per-deploy hash URL (goes stale after ~30 days)

---

## 3. Environment Variables

```
PROCESS_SECRET=webgecko2026!
ADMIN_SESSION_SECRET=<Vercel>
ANTHROPIC_API_KEY=<see Vercel dashboard>
STITCH_API_KEY=<see Vercel dashboard>
NEXT_PUBLIC_APP_URL=https://webgeckofl.vercel.app
PEXELS_API_KEY=<MUST ADD — Zack created Pexels account, get key from pexels.com/api/new>
(+ SUPABASE, VERCEL_TOKEN, STRIPE, BEEHIIV, RESEND, TAWK, INNGEST, SQUARE, CLOUDFLARE_TURNSTILE)
```

**PEXELS_API_KEY** is in `.env.local` as `YOUR_PEXELS_KEY_HERE` placeholder. Must replace locally AND add to Vercel dashboard → Settings → Environment Variables.

---

## 4. Critical Developer Notes

### NTFS Edit Tool Truncation Bug
**Most important issue.** Any Edit tool write to files >~100KB on Windows/NTFS risks truncating the file mid-byte. This has happened many times with inngest/route.ts, auditor.ts, and pipeline-helpers.ts.

**Signs:** TSC errors like `TS1005: '}' expected` at last line, or `tail` shows file ends mid-statement.

**Fix — always use Python write-back for large files:**
```python
with open('/sessions/eager-lucid-knuth/mnt/webgecko/app/api/inngest/route.ts', 'rb') as f:
    data = f.read()
data = data.replace(b'\x00', b'')  # strip null bytes first
src = data.decode('utf-8')
src = src.replace(OLD, NEW)
with open('/sessions/eager-lucid-knuth/mnt/webgecko/app/api/inngest/route.ts', 'w', encoding='utf-8') as f:
    f.write(src)
```

After any edit, run: `tail -10 /sessions/eager-lucid-knuth/mnt/webgecko/app/api/inngest/route.ts` and check it ends with `});` not mid-string.

### Git lock files
Run before any git operation:
```powershell
Remove-Item -Force C:\Users\zackr\webgecko\.git\index.lock -ErrorAction SilentlyContinue
Remove-Item -Force C:\Users\zackr\webgecko\.git\HEAD.lock -ErrorAction SilentlyContinue
```

### Standard git push workflow
```powershell
Remove-Item -Force C:\Users\zackr\webgecko\.git\HEAD.lock -ErrorAction SilentlyContinue
git -C C:\Users\zackr\webgecko add -A
git -C C:\Users\zackr\webgecko commit -m "your message"
git -C C:\Users\zackr\webgecko push
```

### TSC check
```bash
cd /sessions/eager-lucid-knuth/mnt/webgecko && npx tsc --noEmit 2>&1 | grep -v "ui-history.json"
```
Ignore `ui-history.json` error (pre-existing malformed JSON, doesn't affect build).

### Bash paths (Linux sandbox)
```
C:\Users\zackr\webgecko  →  /sessions/eager-lucid-knuth/mnt/webgecko/
C:\...\outputs           →  /sessions/eager-lucid-knuth/mnt/outputs/
C:\...\uploads           →  /sessions/eager-lucid-knuth/mnt/uploads/
```

---

## 5. Session 1 Changes (2026-05-12)

- Pipeline: newsletter/FAQ/testimonials injection scoped to `data-page="home"` only
- Smoke test: stable alias URL, 3s/6s/9s delays
- Security: `stripe/callback` HMAC CSRF, `preview/proxy` auth gate, `client-login` PATCH sanitisation
- Admin: removed To-Do tab, checklist "Mark section complete" + "Push Website Live" CTA
- Intake form: made ABN/domain/address/GA4 optional; removed AI language
- Client portal: business details card redesigned; GA4 field added; `ClientData` interface fixed
- Validators: gallery thin-page uses raw HTML length not stripped text; fallback gallery content fattened
- Audit report: `WebGecko-Audit-Report.docx` — 50 findings

---

## 6. Session 2 Changes (2026-05-13)

### Footer always at bottom (CRITICAL fix)
**Problem:** Legal pages (privacy/terms) and fallback contact section were being injected via `replace("</body>", ...)` which put them AFTER the `<footer>` tag — ~38KB of content after footer.

**Fixes:**
- `lib/auditor.ts` `injectLegalPages()`: inject before `<footer` not `</body>`
- `app/api/inngest/route.ts` contact fallback: inject before `<footer` not `</body>`

### Admin auth 403 fixes
All these routes had raw `secret !== process.env.PROCESS_SECRET` checks that failed because admin passes `secret=""`. Replaced all with `isAdminAuthedLegacy(req)`:
- `app/api/unlock/release/route.ts`
- `app/api/versions/route.ts`
- `app/api/versions/html/route.ts`
- `app/api/analytics/monthly/route.ts`
- `app/api/payment/unlock/route.ts`
- `app/api/unlock/booking/route.ts`
- `app/api/stripe/sync-shop/route.ts`

### Client portal: content API auth
`app/api/client/content/route.ts` POST: added auth gate — `wg_client_slug` cookie OR `x-process-secret` admin header.

### Inngest route: serve export restored
File was truncated, losing the `serve()` export. Restored:
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports, autoRelease, featureInject, featureGoLive],
});
```

### Auditor: `addSectionIdSmart` depth-counter
**Problem:** Old `homeWrapperRe` regex matched first `</div>` (orb element at depth=0), injecting FAQ inside hero.

**Fix:** Depth-counter to find true closing tag of `data-page="home"` wrapper. Also skip orb/absolute elements:
```typescript
if (cm && /\borb\b|position[\s:]*absolute|z-index[\s:]*-/i.test(cm[1])) return m;
```

### Auditor: broadened heading patterns
- FAQ: `faq|frequently asked|common questions|common queries|questions answered|got questions|have questions`
- Testimonials: `testimonial|what.*client|what.*customer|what people say|trusted by|our clients|happy clients|client stories`

### Auditor: duplicate contact section removal
When two `id="contact"` exist (Stitch has one + pipeline injected fallback), auditor removes the injected fallback:
```typescript
fixed = fixed.replace(/<section id="contact" style="padding:80px 24px;background:#0f172a[^"]*"...>[\s\S]*?<\/section>/i, '');
```

### Inngest: contact section smart injection
Before injecting fallback, tries to stamp `id="contact"` onto existing Stitch contact section:
```typescript
const stitchContactRe = /<(section|div)([^>]*class="[^"]*(?:contact|get-in-touch)[^"]*"[^>]*)>/i;
```

### "How It Works" button wiring
All unwired `<button>How It Works</button>` now scroll to `#features`, `#services`, `#how-it-works`, or `#contact`:
```typescript
html = html.replace(/<button([^>]*)>How It Works<\/button>/gi, ...)
```

### Pexels photo integration (NEW)
Added `fetchPexelsPhoto(query, orientation)` to `lib/pipeline-helpers.ts`. In Step 6:
- If no `heroUrl`: fetch `"{industry} professional"` from Pexels
- If no `photoUrls`: fetch 3 general photos for gallery
- **Requires `PEXELS_API_KEY` in both `.env.local` and Vercel dashboard**

### `injectImages`: Stitch hero fix
Updated runtime script to inject `<img>` into empty relative hero div (Stitch right-column visual):
```javascript
var relDiv = heroSection.querySelector("div[class*='relative'][class*='h-']");
// inject <img position:absolute;inset:0>
```

### Hardcoded URL fixes
All `webgecko-builder.vercel.app` → `webgeckofl.vercel.app` throughout codebase.

### jobId/slug collision fix (`app/api/worker/route.ts`)
- `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
- `safeFileName(businessName) + "-" + crypto.randomBytes(3).toString("hex")`

### Client portal: onboarding tour + Pay Now banner
- 5-step onboarding tour on first login (detected via `localStorage.getItem(\`wg_tour_done_${slug}\`)`)
- "Pay Now" gradient banner at top when deposit not paid

### Intake form: pricing SelectCard icon
Changed `icon="✅"` → `icon="💰"` (looked like a checkbox)

---

## 7. Pipeline HTML Debugging (Uploaded Files)

Files uploaded: `ai-dartboard-scorer-STITCH-RAW (1/2).html` and `FINAL (2/3/4).html`

Key findings that drove fixes:
- Footer at 36968, body ends at 75428 → 38KB after footer (**fixed**)
- Legal pages at indices 64863/70218 — outside multi-page wrapper (**fixed**)
- FAQ at index 10071 — inside hero (orb div match) (**fixed**)
- Contact at 38383 — after footer (**fixed**)
- Hero right column: empty `div.relative.h-[400px]` with floating stat cards, no image (**Pexels fix**)
- "Common Queries" not matched by old FAQ pattern (**heading pattern fix**)
- Testimonials: `class="py-xl px-gutter bg-surface-container-highest"` not matched, "Trusted by QLD Legends" now caught (**fix**)

---

## 8. Session 3 Changes (2026-05-13)

### Social Media Tab — Full Redesign (`app/c/[slug]/page.tsx`)

**Upsell page (non-social clients):**
- **No-scroll desktop layout** — single viewport, two-column: features + plan cards on left, action panel on right
- **4-plan pricing** (research-based, competitive vs AU agencies charging $800–$2,500/mo):
  - Starter: $399/mo — 2 platforms, 12 posts
  - Growth: $699/mo — 4 platforms, 20 posts (Most Popular)
  - Full Suite: $1,099/mo — all platforms, 36 posts + ads (Best Value)
  - Custom: "Let's chat" — sends custom quote request to admin dashboard
- **Plan selection UI** — click to select, right panel shows full feature list + CTA button
- **Custom plan** includes a free-text note field; admin receives plan name + note via `/api/client/upgrade-request`
- **FAQ panel** — 5 quick answers (no lock-in, approval mode, platforms, etc.)
- Market context blurb explaining pricing vs competitors

**Active social client dashboard:**
- **Inner tab bar**: Overview · Calendar · Post Brief · Setup
- **Overview tab**: stats row (followers/posts/engagement), connected platforms card, posting preference (auto/approve), recent posts sidebar — all in two-column no-scroll layout
- **Calendar tab**: full post list with platform icons, status badges, approve/edit buttons for manual mode
- **Post Brief tab**: photo upload + brief + tone + platform selector → submits to `/api/client/social-upload`
- **Setup tab** — new account setup flow with two clear paths:
  1. **"I already have accounts"** (Link flow): select platforms → we send secure connection request via Meta Business Suite / TikTok Creator Portal / LinkedIn. No passwords shared.
  2. **"Start from scratch"** (Create flow): 5-step process — we create Gmail (client CC'd on all emails for full transparency) → legal agreements → all platforms created & branded → linked to Metricool → client resets password and takes full ownership
- Both setup paths submit via `/api/client/upgrade-request` with `type: "social_link_existing"` or `type: "social_create_accounts"`

**New state vars added:**
- `socialSelectedPlan`, `setSocialSelectedPlan` — which plan card is selected
- `socialUpgradeState` — idle/loading/done/err for upgrade CTA
- `socialCustomNote` — free text for custom plan requests
- `socialSetupStep` — null | "choose" | "link" | "create"
- `socialActiveTab` — overview | calendar | brief | setup

**Commit:** `32a4b29`

### Admin Social View — Full Redesign (`app/admin/page.tsx` → `SocialView`)

**Layout:** 3-column no-scroll dashboard (stats strip + col1: client roster / col2: checklist / col3: queue+links)

**Client roster (col 1):**
- Real client cards from DB (falls back to mock data if none)
- Platform icons, per-client onboarding progress bar (e.g. 7/12 steps)
- Click a client to load their checklist — persisted in `localStorage` keyed by slug

**Interactive onboarding checklist (col 2):**
- 12-step checklist, checkable — state saved per client in localStorage (`wg_social_checks_{slug}`)
- Each step with relevant URLs gets an **"↗ Open URLs (n)"** button — opens all setup tabs at once
  - Step 3: Calendly
  - Step 4: Google signup + Gmail
  - Step 5: Meta Business Suite, Facebook Pages, Instagram signup
  - Step 6: TikTok Business Center
  - Step 7: LinkedIn company page creator
  - Step 8: Google Business, YouTube Studio
  - Step 9: Metricool app (×2)
  - Step 12: Metricool app
- Checked steps get strikethrough + green tick; "Reopened" label if URLs already opened
- Progress bar + percentage pill at top; completion celebration card at 100%

**Col 3:**
- Approval queue (approve/edit/reject per post)
- Metricool status card with Open + Sync buttons
- Quick setup links panel — 7 direct links (Meta, TikTok, Google, LinkedIn, GBP, YouTube, Metricool)

**Commits:** `32a4b29` (client portal), `9ad26e2` (admin) — both need `git push` from Windows terminal

---

## 9. Known Issues / Pending

1. **Pexels API key not set** — `.env.local` has placeholder, Vercel doesn't have it (Zack confirmed added to Vercel dashboard — verify it's live)
2. **ui-history.json** — malformed JSON, pre-existing, ignore
3. **Inngest route truncation-prone** — check `tail` after every edit, always TSC before push
4. **Contact dedup regex** — matches `background:#0f172a`; if client's theme uses same color, wrong section could be removed (low risk)
5. **`.bak` files** — added to `.gitignore` but may be tracked; run `git rm --cached "*.bak"` if needed
6. **Social setup flow** — currently sends to `/api/client/upgrade-request` which emails admin; consider a dedicated admin UI panel to manage setup steps and mark them complete

---

## 10. Checklist for Next Session

- [ ] `git push` from Windows terminal (commit `32a4b29` is staged locally)
- [ ] Add real Pexels API key to `.env.local` if not already (Vercel reportedly done)
- [ ] Test a new full build after all fixes and verify footer position, FAQ/testimonials, contact, hero image
- [ ] Check if `featureInject` and `featureGoLive` Inngest functions work end-to-end
- [ ] Consider splitting `app/api/inngest/route.ts` into separate files (currently 2,200+ lines, constant truncation risk)
- [ ] Admin dashboard: add social setup status tracking (which step each client is on)
- [ ] Social pricing: revisit after first few social-only clients sign up (adjust if needed)
