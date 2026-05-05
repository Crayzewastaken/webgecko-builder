# WebGecko Pipeline — Full Codebase Context

## Project
`C:\Users\zackr\webgecko` — a Next.js SaaS that auto-builds websites for Australian small businesses. A client fills out a form, pays a deposit via Square, and the pipeline generates a full website using Stitch (Google's AI design tool) + Claude Haiku, deploys to Vercel, and optionally sets up a SuperSaas booking system.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (app router, route handlers) |
| Pipeline orchestration | Inngest — serverless step functions |
| AI designer | Stitch SDK (`@google/stitch-sdk`) — returns HTML via `downloadUrl` |
| AI content/rebuild | Claude Haiku — rewrites Stitch HTML to guarantee structure |
| Deployment | Vercel API — each site deployed as a separate project |
| Database | Supabase — tables: `clients`, `jobs`, `bookings`, `payment_state`, `analytics` |
| Booking | SuperSaas — schedule + sub-user created automatically in Step 0 |
| Payments | Square — payment links, webhooks, OAuth for client shop |
| Email | Resend |
| Image upload | Cloudinary |
| Live chat | Tawk.to (auto-creates property per client) |
| Newsletter | Beehiiv (subscribes client to WebGecko list) |
| CAPTCHA | Cloudflare Turnstile |
| SEO/indexing | Serper API (SERP intelligence) + Google Indexing API |

---

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Client intake form (9-step wizard) |
| `app/api/inngest/route.ts` | Main build pipeline (Steps 0–10), ~1400 lines |
| `app/api/payment/webhook/route.ts` | Square webhook — triggers build on deposit paid |
| `app/api/payment/create/route.ts` | Creates Square payment links |
| `app/api/worker/route.ts` | Intake: parses form, uploads images, saves to Supabase, emails quote |
| `app/api/admin/activate/route.ts` | Manual admin trigger — kept for overrides/rebuilds |
| `app/api/unlock/release/route.ts` | Sends "preview ready" email to client, unlocks portal |
| `app/c/[slug]/page.tsx` | Client portal |
| `app/admin/page.tsx` | Internal admin dashboard |
| `lib/blueprint.ts` | Claude Haiku blueprint generator (was gemini.ts — renamed) |
| `lib/pipeline-helpers.ts` | `normalizePageId`, `repairHtml`, `validateForDeploy`, `injectEssentials`, `ensureMultiPageStructure`, `checkAndFixLinks` |
| `lib/auditor.ts` | Post-build audit and surgical HTML fixes |
| `lib/supersaas.ts` | SuperSaas schedule + sub-user creation |
| `lib/square.ts` | Square payments + catalogue API |
| `lib/tawkto.ts` | Tawk.to property creation |
| `lib/db.ts` | Supabase helpers (`getJob`, `saveJob`, `getClient`, `saveClient`, etc.) |
| `lib/encryption.ts` | Payload encryption (env-keyed with legacy fallback) |
| `lib/admin-auth.ts` | Admin session cookie helper |
| `scripts/test-multipage.ts` | Unit tests for `ensureMultiPageStructure` (26 tests, all pass) |

---

## Full Automated Flow (No Manual Steps Required)

### 1. Client fills form → submits → `POST /api/worker`
- Verifies Cloudflare Turnstile (blocks bots)
- Uploads images to Cloudinary
- Saves job to Supabase (`status: "awaiting_payment"`)
- Saves client record with hashed password
- Emails client their quote + portal link + login credentials
- Emails owner "new lead" notification

### 2. Client pays deposit → Square webhook → `POST /api/payment/webhook`
- Verifies Square HMAC signature
- Updates `payment_state` table
- **If NO booking feature selected → auto-triggers Inngest build immediately**
- **If booking feature selected → also auto-triggers build** (Step 0 creates SuperSaas schedule automatically); emails admin to verify schedule looks right
- Sets `scheduledReleaseAt` (10–12 days based on complexity) in job metadata

### 3. Inngest pipeline runs (`build/website` event)

| Step | What happens |
|---|---|
| Step 0 | SuperSaas schedule created (if booking). Sub-user created for client. Booking URL stored. |
| Step 1 | Claude Haiku generates site blueprint: palette, fonts, hero copy, Stitch prompt. Includes SERP intelligence (Serper API) + LSI keywords if `SERPER_API_KEY` set. |
| Step 2 | Stitch project created |
| Step 3 | Stitch generates HTML. Handles `sessionId` async fallback + retry. |
| Step 4 | Fetch Stitch HTML |
| Step 4b | Claude Haiku rewrites HTML: guarantees all `data-page` wrappers, required IDs, nav, booking iframe, real contact details, video background, testimonials, social links |
| Step 5 | Code fixes: email/phone/address replacement, CTA links, Google Maps injection, video background injection, social links injection, newsletter form injection, real testimonials injection, Stitch script strip |
| Step 6 | `injectEssentials`: navigateTo router, hamburger JS, multi-page init, FAQ accordion, form handler, GA4, Tawk.to |
| Step 6b | Auditor: patches missing hamburger, contact/FAQ/testimonials/booking sections, placeholder emails, broken nav |
| Step 6c | Booking section: deterministically replaces `id="booking"` with SuperSaas iframe or phone CTA |
| Step 7 | Square shop: creates catalogue items + payment links (needs client OAuth token) |
| Step 7b | Pre-deploy validation: checks all `data-page` wrappers, required IDs, no truncated tags |
| Step 8 | Deploy to Vercel. Fires Google Indexing API ping. |
| Step 8b | Smoke test: 15+ checks on live URL |
| Step 8c | Fail loop: up to 2 re-audit/redeploy attempts |
| Step 9 | Save to Supabase (`status: "completed"`), preserve `scheduledReleaseAt`, update client record, Beehiiv subscription |
| Step 10 | Email owner with build checklist + smoke results |

### 4. Auto-release (Inngest cron, every 6 hours)
- Finds all `completed` jobs where `scheduledReleaseAt` is in the past and `alreadyReleased !== true`
- Calls `/api/unlock/release` which emails client "your preview is ready" + unlocks portal

---

## Multi-Page Architecture

`data-page="id"` is the **sole authoritative router marker**. `.page-section` is a visual class only — never used as router truth.

```html
<div data-page="home" id="home" class="page-section active">...</div>
<div data-page="about" id="about" class="page-section">...</div>
```

Router CSS (injected by `injectEssentials`, never authored by Claude):
```css
[data-page]{display:none!important}
[data-page].active{display:block!important}
```

`normalizePageId(label)` converts "About Us" → "about", "Book Appointment" → "booking", etc. Exported from `lib/pipeline-helpers.ts`.

Required IDs (smoke test checks these):
- `id="hero"` inside home page wrapper
- `id="testimonials"` on home or about
- `id="faq"` with real accordion
- `id="contact"` with real form
- `id="booking"` when booking feature enabled

`ensureMultiPageStructure(html, requestedPageIds)` in `lib/pipeline-helpers.ts` deterministically guarantees every requested page has exactly one `data-page` wrapper, promotes matching sections, injects fallbacks for missing pages, removes invalid `navigateTo` targets.

---

## Feature Bundles — Status & Pipeline Wiring

### ✅ Contact & Enquiries
- Facebook, Instagram, LinkedIn, TikTok URLs collected in form
- All four injected into footer in Step 5 with icon buttons
- URL normalisation handles `@handle` format automatically
- No setup needed

### ✅ Trust & Reviews
- "Customer Testimonials" textarea in Final Details step
- Real quotes parsed from `"Quote" — Name, Location` format
- Injected into `id="testimonials"` in Step 5, replacing AI-generated ones
- Falls back to AI-generated Australian names if left blank

### ✅ Location & Maps
- Business address collected at intake
- Google Maps iframe injected in Step 5 into `id="contact"`
- Uses `GOOGLE_MAPS_API_KEY` if set (Embed API); falls back to free `maps.google.com?output=embed`

### ✅ Bookings & Appointments
- Step 0 auto-creates SuperSaas schedule + sub-user
- `bookingServices` field sets service dropdown options
- `existingBookingUrl` field lets client supply their own booking URL
- Step 6c injects SuperSaas iframe into `id="booking"` section
- Admin notified to verify schedule looks right (does NOT block build)
- **Requires:** `SUPERSAAS_ACCOUNT_NAME`, `SUPERSAAS_API_KEY` env vars

### ⚠️ Online Shop & Payments
- Step 7 creates Square catalogue items + individual payment links
- **Requires client to connect Square OAuth after build** (payments go to their account)
- Client connects Square in their portal (`/c/[slug]`)
- Falls back to manual payment URL if no OAuth token
- `shopProducts` textarea collected for clients who skip the pricing flow
- **Requires:** `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `OAUTH_STATE_SECRET` env vars

### ✅ Blog & Content
- Blog topics field collected at intake
- Topics injected into Step 4b Claude prompt and blueprint Stitch prompt
- 3–4 blog preview cards generated on Blog page
- Static only — no CMS behind it

### ✅ Photo Gallery
- Up to 5 photos uploaded at intake → Cloudinary → `injectImages` wires into gallery section
- Falls back to Unsplash/placehold.co if no photos

### ⚠️ Growth & Marketing (3 sub-features)
- **Newsletter Signup**: Injects real email signup form (`id="newsletter"`) onto client site in Step 5. Also subscribes client's own email to WebGecko's Beehiiv list. **Requires:** `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID`
- **Live Chat**: Tawk.to property auto-created in Step 6. Widget injected via `injectEssentials`. May return 404 on some Tawk.to plans (non-fatal, build continues). **Requires:** `TAWKTO_API_KEY`
- **Pop-up Form**: Label exists in bundle but **not yet implemented** — no pipeline code produces a pop-up. Either implement or remove from bundle description.

### ✅ Video Background
- YouTube URL or direct MP4 URL collected in form
- YouTube URLs auto-converted to embed format
- Step 4b tells Claude to build hero with video background
- Step 5 injects `<video>` or YouTube `<iframe>` into `id="hero"` with autoplay/muted/loop + dark overlay + z-index
- Falls back to industry-matched stock video if no URL provided

---

## Security Fixes Applied

1. **Preview proxy CSP**: `Content-Security-Policy: sandbox` headers prevent generated HTML from accessing WebGecko cookies/storage
2. **Encryption key**: `PAYLOAD_ENCRYPTION_KEY` env var; legacy key fallback for decrypting old records only
3. **Square OAuth state**: HMAC-signed state with slug + jobId + timestamp + nonce. Verified in callback.
4. **Admin auth**: HttpOnly `wg_admin_session` cookie. `isAdminAuthedLegacy()` accepts cookie OR query param (backward compat). Admin secret no longer in URLs.
5. **Client passwords**: scrypt hashed (N=16384). Login upgrades plaintext legacy passwords on first login.
6. **Turnstile**: Missing/failed token returns 403 in production before any processing
7. **SuperSaas credentials**: Password never stored in job metadata or embedded in iframe URLs

---

## Known Patterns & Gotchas

- **Edit tool truncates large files** — always use Python `str.replace()` write-back for `inngest/route.ts`, `admin/page.tsx`, `pipeline-helpers.ts`
- **Nested backticks** — use string concatenation inside template literals to avoid TS parse errors
- **`\\w` in TS template literals** — `\\w` in source → `\w` in emitted HTML (correct for JS regex)
- **Stitch `sessionId`** — when Stitch returns `sessionId` instead of `downloadUrl`, the `sessionId` IS the `screenId`. Call `get_screen` with `{projectId, screenId, name: "projects/P/screens/S"}`
- **Tawk.to 404** — plan limitation, logged as `warn`, never blocks build
- **SuperSaas sub-user 400** — non-fatal, happens when client email matches master account email
- **`status: "complete"` vs `"completed"`** — Step 9 now saves `"completed"`. `autoRelease` filters both for backward compat with old jobs.
- **`scheduledReleaseAt` preservation** — Step 9 re-reads job from DB before saving to preserve metadata set by the webhook between job load and step 9 running

---

## Required Env Vars

### Critical (pipeline fails without these)
```
ANTHROPIC_API_KEY          # Claude Haiku for blueprint + HTML rebuild
STITCH_API_KEY             # Google Stitch design generation
VERCEL_API_TOKEN           # Deploy each site as Vercel project
VERCEL_TEAM_ID             # Optional if personal account
SUPABASE_SERVICE_ROLE_KEY  # DB read/write
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RESEND_API_KEY             # All transactional email
RESULT_TO_EMAIL            # Owner notification email (crayzewastaken@gmail.com)
CLOUDINARY_CLOUD_NAME      # Image upload
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
SQUARE_ACCESS_TOKEN        # WebGecko's Square account (deposit/final payment links)
SQUARE_LOCATION_ID
SQUARE_WEBHOOK_SIGNATURE_KEY
PROCESS_SECRET             # Admin auth + release endpoint
TURNSTILE_SECRET_KEY       # Bot protection
NEXT_PUBLIC_TURNSTILE_SITE_KEY
PAYLOAD_ENCRYPTION_KEY     # Min 32 bytes — encrypts stored payloads
OAUTH_STATE_SECRET         # HMAC for Square OAuth state
ADMIN_SESSION_SECRET       # Admin cookie signing
```

### Feature-specific (graceful fallback if missing)
```
SUPERSAAS_ACCOUNT_NAME     # Required for Booking feature
SUPERSAAS_API_KEY          # Required for Booking feature
SQUARE_APPLICATION_ID      # Required for Shop OAuth (client connects their Square)
SQUARE_APPLICATION_SECRET
TAWKTO_API_KEY             # Live Chat — 404s gracefully if plan doesn't support it
BEEHIIV_API_KEY            # Newsletter — skipped if missing
BEEHIIV_PUBLICATION_ID
GOOGLE_MAPS_API_KEY        # Optional — falls back to free embed URL
SERPER_API_KEY             # Optional — SERP intelligence for better SEO content
GOOGLE_INDEXING_SA_KEY     # Optional — base64 service account JSON for Search Console ping
```

### Not currently used / legacy
```
PB_EMAIL / PB_PASSWORD     # PocketBase — only used in old /api/secure-submit route (not in main pipeline)
```

---

## Pending / Not Yet Done

- **Pop-up Form** in Growth bundle: labeled but no implementation
- **Domain registration** (Synergy Wholesale): not implemented
- **ABN registration**: not implemented
- **SEO pages per website**: not yet generating per-page meta tags, sitemap.xml, robots.txt for client sites
- **Legal ToS/Privacy Policy pages**: not yet generated per client site
- **Beehiiv newsletter on CLIENT's site**: now injects a signup form, but the form submissions go nowhere server-side — needs a `/api/newsletter-subscribe` endpoint that proxies to Beehiiv using the client's own publication (or WebGecko's)
- **Square shop**: client must still connect OAuth manually in portal after build — no way around this (payment regulations require merchant OAuth)
- **`app/api/admin/fix-proxy/route.ts` booking component**: uses `generateBookingWidget()` — separate code path, may need `data-page="booking"` review
