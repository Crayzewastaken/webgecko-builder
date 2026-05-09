# WebGecko Builder — Complete Error Log

> All bugs, failures, and fixes across the full project history (~180+ commits) and live debug sessions.
> Organized by category. Every entry is a real problem that was encountered and had to be resolved.

---

## 1. Stitch SDK / MCP Integration

### 1.1 Stitch MCP OAuth / Tool not found (early architecture)
- **Error**: `Tool stitch_generate not found` / MCP server not reachable
- **Cause**: Early pipeline used raw MCP HTTP calls to `stitch.googleapis.com`. OAuth token management was manual and unreliable.
- **Fix**: Replaced raw MCP calls with `@google/stitch-sdk` high-level SDK. SDK handles OAuth via `STITCH_API_KEY` env var automatically.
- **Commit**: `940fbe1`, `89824b2`

### 1.2 `get_screen not found` error
- **Error**: `get_screen: resource not found` when polling for screen after generate
- **Cause**: `sessionId` returned by generate was being used as `screenId` — they are different fields
- **Fix**: Changed to use `list_screens` to find the actual `screenId` for the session
- **Commit**: `294fb8e`, `ac9c72c`

### 1.3 `list_screens` returning 0 screens every poll
- **Error**: `STEP 3b: screens list returned 0 items (poll 1/8)` — all 8 polls empty
- **Cause**: `list_screens` required a `projectId` param, not `parent`. Also Stitch hadn't finished rendering within the 45s sleep window.
- **Fix**: Added `projectId` param; extended sleep to 90s; increased polls to 8×20s
- **Commit**: `7b015`, `42ad3dd`

### 1.4 "Stitch: no signed URL after polling" — fundamental architecture error
- **Error**: `Error: Stitch: no signed URL after polling` — pipeline failing completely
- **Cause**: The entire polling architecture was wrong. `generate()` is a **blocking/synchronous** call — it does not return until Stitch has finished rendering. Treating it as fire-and-forget and then trying to poll for results was fundamentally flawed.
- **Fix**: Collapsed steps 3a + sleep + 3b into a single step. Call `generate()` directly, then call `getHtml()` immediately on the returned Screen object.
- **Commit**: `6141ebe`

### 1.5 `getHtml()` returning empty URL after `generate()` succeeds
- **Error**: `STEP 3: getHtml() returned url length=0`
- **Cause**: `getHtml()` checks `this.data?.htmlCode?.downloadUrl` from the generate response. Sometimes this field is absent in the API response even when generation succeeded. The fallback `get_screen` call also returned no URL immediately.
- **Fix**: After `generate()` + `getHtml()` returns empty, poll `project.getScreen(screenId)` up to 5× with exponential backoff (5s, 10s, 15s, 20s, 25s).
- **Commit**: `a1daab9`

### 1.6 Stitch SDK version mismatch
- **Error**: `@google/stitch-sdk` at `^0.1.0` was outdated; `getScreen()` method signature changed
- **Fix**: Upgraded to `^0.3.4`
- **Commit**: `6141ebe`

### 1.7 "DO NOT RETRY" rule violated
- **Error**: Stitch SDK documentation explicitly states do not retry generate calls — retry causes duplicate generations and billing
- **Fix**: Removed all retry loops around `generate()`; one attempt only
- **Commits**: `9e25553`, `77b0c06`

### 1.8 Stitch nav scripts conflicting with injected navigation
- **Error**: Stitch-generated nav scripts were overriding `window.navigateTo` or creating duplicate event listeners
- **Fix**: Added stripping pass to remove Stitch-generated nav/scroll scripts before injecting custom navigation
- **Commits**: `f65a2c7`, `ec21845`

### 1.9 Stitch generating signup-style contact form
- **Error**: Contact section contained fields: Business Name, Project Goals dropdown, "Initialize Transmission" submit button — looked like a client registration form
- **Cause**: Stitch interpreted the brief generically; no explicit field constraints in prompt
- **Fix**: Blueprint prompt now mandates exactly 4 fields (Full Name, Email Address, Phone Number, Message) and submit text "Send Message"
- **Commit**: `15b7e7c`, `c43e979`

### 1.10 Stitch generating address in hero subheadline
- **Error**: Physical business address appearing in hero section subheadline copy
- **Cause**: No explicit constraint in blueprint prompt about address placement
- **Fix**: Blueprint prompt: "The physical address ONLY appears inside section id=contact. Nowhere else. Not in hero. Not in stats. Not in subheadline."
- **Commit**: `15b7e7c`

### 1.11 Stitch generating map as text link instead of iframe
- **Error**: Map section rendered as `<a href="https://www.google.com/maps/...">View on Maps</a>` plain text link
- **Cause**: Stitch chose a link element instead of an iframe embed
- **Fix**: Added strip pass for `<a href="...maps...">` links in pipeline; then injects proper `<iframe src="https://www.google.com/maps/embed?...">` block
- **Commit**: `c43e979`

### 1.12 Duplicate map appearing (two maps in output)
- **Error**: Both an `<iframe>` map (from pipeline injection) AND the Stitch-generated map/link appeared on the page
- **Cause**: Map injection code didn't strip pre-existing maps before injecting
- **Fix**: Strip both `<iframe>` elements containing "maps" src AND `<a href="...maps...">` links before injecting the authoritative iframe
- **Commits**: `403940e`, `c43e979`

### 1.13 Map overlapping two-column contact layout
- **Error**: Map iframe was injecting inside the contact section's `</div>`, landing in the middle of the two-column grid and breaking the layout
- **Cause**: Regex found last `</div>` inside the contact section and inserted before it
- **Fix**: Map now injects as a standalone full-width block **after** the contact section's close tag (`</section>` or closing `</div>`)
- **Commit**: `c43e979`

### 1.14 Stitch progressive prompt fallback
- **Error**: Stitch failing completely for certain industry/business types
- **Fix**: Added progressive prompt fallback — simplified prompt if complex prompt fails; Claude HTML generation as final fallback if Stitch fails entirely
- **Commit**: `e5a9ae0`

---

## 2. CTA Buttons & Navigation

### 2.1 CTA buttons linking to `webgecko-builder.vercel.app`
- **Error**: "Book Now", "Get Started" etc. buttons linked to the builder app domain instead of client website
- **Cause**: Stitch hard-coded the builder's domain in `href` attributes
- **Fix**: Hard URL sweep regex — unconditionally replaces ALL `<a>` tags with `*.vercel.app` or `webgecko-builder.*` hrefs with `window.navigateTo` onclick
- **Commits**: `15b7e7c`, `c43e979`

### 2.2 CTA keywords not matching "Start Starter Plan" / "Start Business Plan"
- **Error**: Plan selection buttons (`Start Starter Plan`, `Start Business Plan`, `Start Premium Plan`) not being wired to navigateTo
- **Cause**: Keyword list only included `book`, `get started`, `contact us` etc. — didn't include `start`-prefixed plan names
- **Fix**: Added `start starter`, `start business`, `start premium`, `start plan`, `start now`, `explore capability`, `get in touch`, `launch` to CTA keyword list
- **Commit**: `c43e979`

### 2.3 Multi-page nav buttons silently failing
- **Error**: Buttons on multi-page sites did nothing when clicked — no error, no navigation
- **Cause**: `getElementById()` finds hidden page sections (all pages are in DOM simultaneously with `display:none`). The `if(el)` check passes. `scrollIntoView()` runs but has no visible effect on hidden elements. The `navigateTo` fallback was never reached.
- **Fix**: `ctaOnclick` simplified to `window.navigateTo && window.navigateTo(target)` — eliminated `getElementById` + `scrollIntoView` entirely
- **Commit**: `d378e3d`

### 2.4 `href="#section"` links same hidden-element bug
- **Error**: `<a href="#contact">`, `<a href="#booking">` etc. scrolled nowhere on multi-page sites
- **Cause**: `document.querySelector(hr).scrollIntoView()` same problem as above — element exists in DOM but is hidden
- **Fix**: Changed handler to `window.navigateTo(hr.substring(1))` — routes through the authoritative navigation function
- **Commit**: `d378e3d`

### 2.5 Frankenstein onclick handlers — redundant client-side IIFE
- **Error**: Some buttons had conflicting onclick handlers — `navigateTo` call was present but old `scrollIntoView` code was also running
- **Cause**: A client-side labelMap IIFE in `pipeline-helpers.ts` was rewriting only the `navigateTo('xxx')` part of onclick handlers, leaving `getElementById` + `scrollIntoView` logic intact from previous pass
- **Fix**: Deleted the entire client-side IIFE — server-side `fixNavigateToTargets` already handles this correctly
- **Commit**: `d378e3d`

### 2.6 Single-page `navigateTo` hiding all content
- **Error**: On single-page Stitch sites, clicking nav link hid all sections and showed nothing
- **Cause**: `navigateTo` implementation was toggling page visibility (multi-page logic) on a site that didn't have pages
- **Fix**: `navigateTo` now detects single-page vs multi-page — uses smooth scroll on single-page, class toggling on multi-page
- **Commit**: `01102b4`

### 2.7 Hamburger menu not wiring correctly
- **Error**: Mobile hamburger menu button had no click handler or wrong handler
- **Cause**: Stitch sometimes generates hamburger as an SVG element, sometimes as a button — detection logic was too narrow
- **Fix**: Added SVG detection to hamburger wiring logic
- **Commit**: `e93f91c`

### 2.8 `clientCtaUrl` sending users to client's existing website
- **Error**: CTA buttons were linking to the client's existing website (`existingWebsite` field) instead of scrolling to contact/booking
- **Cause**: Pipeline was using `existingWebsite` as the CTA destination URL
- **Fix**: Removed `clientCtaUrl` entirely — all CTAs scroll to booking or contact section
- **Commit**: `403940e`

---

## 3. Blueprint / Prompt Generation

### 3.1 Prompt capped at 5,000 chars
- **Error**: `stitchPrompt` consistently showing as exactly 5,000 chars in logs despite 12,000 limit in `route.ts`
- **Cause**: `blueprint.ts` line 429 had `.slice(0, 5000)` applied to the generated prompt — this was overriding the downstream limit
- **Fix**: Changed to `.slice(0, 12000)` in `blueprint.ts`
- **Commit**: `2dfc06a`

### 3.2 Gemini API unusable (free tier rate limits)
- **Error**: Gemini 503/429 errors — `Service Unavailable`, `Resource Exhausted` — pipeline stalling on blueprint generation
- **Cause**: Gemini free tier has extremely aggressive rate limits; project was hitting them immediately
- **Fix**: Replaced Gemini with Claude Haiku for blueprint generation
- **Commit**: `f336bf9`

### 3.3 Gemini JSON response with unescaped quotes
- **Error**: `JSON.parse failed` on Gemini blueprint response — unescaped double quotes inside string values
- **Fix**: 6-strategy fallback JSON parser chain; surgical `stitchPrompt` extraction
- **Commits**: `a649d51`, `604a9cf`, `9c9f170`

### 3.4 Gemini JSON with control characters
- **Error**: `JSON.parse failed` — Gemini response contained control characters inside strings
- **Fix**: Sanitize Gemini JSON response before parsing
- **Commit**: `477bc1e`

### 3.5 Gemini wrong model name
- **Error**: `Model not found: gemini-2.5-flash`
- **Fix**: Corrected to `gemini-1.5-pro-latest`, then later `gemini-2.0-flash`
- **Commits**: `3cf4952`, `88fbaa4`, `9b745fb`

### 3.6 Blueprint JSON truncation — unterminated string
- **Error**: `extractJson: unterminated string` — Claude/Gemini response cut off mid-JSON
- **Cause**: Token limit too low (2,000 tokens); long business descriptions caused truncation
- **Fix**: Robust JSON extractor with multi-strategy fallback; raised token limit
- **Commits**: `a8fc263`, `eaa9f45`, `0d4b5f8`

### 3.7 Blueprint `stitchPrompt` word count instruction too vague
- **Error**: Stitch prompts being generated too short (under 500 words) or too long (over 3,000 words)
- **Fix**: Explicit `"1000-2000 words"` instruction in blueprint prompt
- **Commit**: `15b7e7c`

### 3.8 Blueprint CRITICAL RULES block couldn't be found by Python string match
- **Error**: Python replacement script failed to find the target string in `blueprint.ts`
- **Cause**: Template literal strings like `${clientEmail}` in the file caused exact string matching to fail
- **Fix**: Used Python line-number based replacement instead of string search
- **Session fix** (not committed separately)

---

## 4. File Corruption & Truncation

### 4.1 `blueprint.ts` truncated mid-string — `Expected ':', got '<eof>'`
- **Error**: Vercel build error: `Expected ':', got '<eof>'` at `blueprint.ts` line 510
- **Cause**: Edit tool write truncated the file at line 509, leaving a hanging string literal
- **Fix**: Python atomic write to restore last 3 lines correctly
- **Commit**: `3688630`

### 4.2 `blueprint.ts` junk appended — `} : String(e));` syntax error
- **Error**: `Expression expected` at `blueprint.ts` line 512 — `} : String(e));` on its own line
- **Cause**: Shell `echo >>` append wrote a new line after the already-complete line 510 instead of replacing it
- **Fix**: Python to detect 512-line file, strip the 3 appended junk lines
- **Commit**: `9f16e1c`

### 4.3 `blueprint.ts` truncated at "Authorizati" — second truncation
- **Error**: File ended abruptly mid-word at line 497 of what should be 512 lines
- **Cause**: Edit tool write truncation on second pass
- **Fix**: `git show HEAD:lib/blueprint.ts > lib/blueprint.ts` restore, then Python re-apply all changes
- **Session fix**

### 4.4 `blueprint.ts` duplicate tail — syntax error at line 501
- **Error**: Build error: duplicate code at end of `blueprint.ts` causing syntax errors
- **Cause**: Accidental double-append during edit
- **Fix**: Remove duplicate tail
- **Commit**: `29a75e5`

### 4.5 `blueprint.ts` corrupt tail — second instance
- **Error**: Build error from corrupt/duplicate tail in `blueprint.ts`
- **Fix**: Remove corrupt tail
- **Commit**: `b4f52d6`

### 4.6 `pipeline-helpers.ts` truncated at line 1292
- **Error**: File should be 1,293 lines but was only 1,292 — missing closing brace
- **Cause**: Edit tool write truncation
- **Fix**: `git show HEAD:lib/pipeline-helpers.ts > lib/pipeline-helpers.ts` restore
- **Session fix**

### 4.7 `route.ts` duplicate tail — build error
- **Error**: Build error from duplicate closing code at end of `route.ts`
- **Fix**: Remove duplicate tail
- **Commit**: `faf8363`

### 4.8 Null byte corruption — 2,774 null bytes in `route.ts`
- **Error**: Vercel build (Turbopack): `error TS1127: Invalid character` at line 1779
- **Cause**: Null bytes (`\x00`) injected during Edit tool operations over multiple sessions
- **Fix**: Python `data.replace(b'\x00', b'')` stripped all null bytes
- **Commit**: `b4b794b`

### 4.9 `gemini.ts` duplicate tail
- **Error**: Build error from duplicate tail in `gemini.ts`
- **Fix**: Remove duplicate tail
- **Commit**: `cb336c3`

### 4.10 `page.tsx` trailing junk removed
- **Error**: Build error from trailing characters after last JSX element in `page.tsx`
- **Fix**: Remove trailing junk
- **Commit**: `cb336c3`

### 4.11 File writes using `echo >>` causing corruption
- **Error**: Multiple cases of `echo >>` shell appends writing to new lines instead of replacing, creating syntax errors
- **Cause**: Windows line endings + bash echo appending behavior
- **Fix**: All file writes now use Python atomic writes exclusively

### 4.12 Git HEAD.lock / index.lock blocking every commit
- **Error**: `fatal: Unable to create '.git/index.lock': File exists` — every sandbox git commit fails
- **Cause**: Windows file locking; Linux sandbox cannot delete Windows-locked `.git` lock files
- **Fix**: User must manually run `Remove-Item C:\Users\zackr\webgecko\.git\HEAD.lock -Force` before each push
- **Impact**: 5+ commits were unpushed for extended periods each session

---

## 5. Inngest Pipeline

### 5.1 Vercel killing background jobs (pre-Inngest)
- **Error**: Website generation silently failing or returning empty response after 30 seconds
- **Cause**: Vercel serverless functions have 30s (free tier) / 300s (pro) timeout; generation took longer
- **Fix**: Migrated to Inngest for background job processing
- **Commits**: `bef1890`, `8c46d8b`

### 5.2 Inngest `createFunction` syntax error
- **Error**: Inngest function not registering — wrong syntax for trigger config
- **Fix**: Move trigger to config object
- **Commit**: `f29fc97`

### 5.3 Inngest steps returning non-serializable values
- **Error**: Inngest step replay failing — step boundaries require primitive-serializable return values; Screen objects not serializable
- **Cause**: Screen object from Stitch SDK was being passed across step boundary
- **Fix**: Steps only return primitive values (strings, numbers); Screen object used within single step only
- **Session understanding**

### 5.4 Inngest step cache not busting on full rebuild
- **Error**: Rebuild still using old cached HTML from previous Inngest run
- **Cause**: Step names were identical between runs; Inngest replays from cache
- **Fix**: Appended version suffix (`-v2`) to force fresh execution; full rebuild now wipes cached HTML before triggering
- **Commits**: `1b56b0f`, `dd9b1a8`

### 5.5 Inngest streaming timeout
- **Error**: Steps timing out at Vercel's function limit
- **Fix**: Enable Inngest streaming; bump `maxDuration` to 800s
- **Commits**: `eb2200f`, `f9e9a4c`

### 5.6 Inngest serve route not found
- **Error**: Inngest webhook could not reach app — 404 on serve route
- **Fix**: Multiple iterations of configuring `inngest/route.ts` correctly
- **Commits**: `df1bc56`, `c1d6399`, `4031564`

### 5.7 Payment webhook auto-triggering build
- **Error**: Payment webhook was automatically triggering site build — bypassing admin review
- **Fix**: Webhook now only notifies owner; admin must manually trigger build
- **Commit**: `4f10861`

### 5.8 Rebuild not wiping cached HTML
- **Error**: Full rebuild request still serving old HTML because Supabase `html` field not cleared before pipeline started
- **Fix**: Rebuild endpoint now explicitly clears `html` field before triggering Inngest
- **Commit**: `dd9b1a8`

---

## 6. Admin Dashboard / Preview

### 6.1 Live preview never auto-refreshing after rebuild
- **Error**: Admin preview iframe showed old website after rebuild completed — required manual page refresh
- **Cause**: React anti-pattern: `const prevBuiltAt = useState(builtAt)[0]` — initial render value never updates across re-renders
- **Fix**: Changed to `useRef` + `useEffect([builtAt])` — ref tracks previous value correctly
- **Commit**: `403940e`

### 6.2 Preview iframe serving cached HTML from Vercel CDN
- **Error**: Preview iframe showing stale cached version even after new HTML uploaded
- **Cause**: Vercel CDN was caching the preview proxy response
- **Fix**: Preview proxy sets `Cache-Control: no-store` headers; cache busted via `builtAt` timestamp query param
- **Commits**: `25534f7`, `f026fea`

### 6.3 Screenshot thumbnail not updating
- **Error**: Admin thumbnail (screenshotone.com) showing old screenshot after rebuild
- **Cause**: Screenshot service caching old URL
- **Fix**: Cache bust via `builtAt` timestamp appended to screenshot URL
- **Commit**: `403940e`

### 6.4 Admin login 404 / redirect broken
- **Error**: After successful login, `window.location.href` redirect not working in some browsers
- **Fix**: Use `window.location.replace()` instead; add credential headers to login fetch
- **Commits**: `35b0fe5`, `4b27732`

### 6.5 Admin middleware blocking `/api` routes
- **Error**: Login POST returning 403 — middleware was matching and blocking all API routes
- **Fix**: Exclude `/api` routes from middleware matcher pattern
- **Commit**: `b4c4d6d`

### 6.6 Admin login showing no error message
- **Error**: Wrong password showed blank screen instead of error
- **Fix**: Show exact error on admin login page; remove button disabled state
- **Commit**: `b4c4d6d`

### 6.7 Admin middleware using Node crypto (Edge incompatible)
- **Error**: Build error: `crypto` module not available in Edge runtime
- **Fix**: Rewrite middleware using Web Crypto API
- **Commit**: `d4075bf`

---

## 7. SuperSaas Booking Integration

### 7.1 SuperSaas API 400 errors — sub-user creation
- **Error**: `400 Bad Request` when creating SuperSaas sub-user account for client
- **Cause**: Multiple issues: role field expected integer not string; name field should equal email; owner email being sent as sub-user
- **Fix**: Fixed role to integer; set name=email; added owner email guard
- **Commits**: `ab11fa2`, `ef41184`

### 7.2 SuperSaas sub-user creation on free plan
- **Error**: 400/403 error — sub-user API not available on SuperSaas free plan
- **Fix**: Skip sub-user creation if client is on free plan
- **Commit**: `f6d15f6`

### 7.3 SuperSaas Basic auth failing
- **Error**: API calls returning 401 — authentication header malformed
- **Fix**: Correct Basic auth header format
- **Commit**: `7eb13d3`

### 7.4 SuperSaas parse array response
- **Error**: JSON parse error on SuperSaas API response — sometimes returns array, sometimes object
- **Fix**: Handle both array and object response shapes
- **Commit**: `4bbef10`

### 7.5 SuperSaas confirm email not sending
- **Error**: Clients not receiving booking confirmation emails
- **Fix**: Set `confirm_email` flag on SuperSaas booking creation
- **Commit**: `4bbef10`

### 7.6 SuperSaas availability config missing
- **Error**: Booking widget showing no available slots — availability config not created
- **Fix**: Auto-create availability config on SuperSaas account setup
- **Commit**: `66e6cec`

---

## 8. Square Payment Integration

### 8.1 Square payment JSON parse error
- **Error**: `JSON.parse` failure on Square webhook payload
- **Cause**: Square sends non-JSON content type in some edge cases
- **Fix**: Defensive JSON parsing with try/catch
- **Commit**: `96164e7`

### 8.2 Square webhook duplicate events
- **Error**: Build triggering multiple times per payment
- **Cause**: Square sends multiple `payment.created` events for a single payment
- **Fix**: Added dedup guard on webhook handler
- **Commit**: `a22b270`

### 8.3 Square webhook handling wrong event type
- **Error**: Payment confirmation not being processed
- **Cause**: Handler was only listening for `payment.completed` but Square sends `payment.created`
- **Fix**: Handle both `payment.created` and `payment.completed`
- **Commit**: `a22b270`

### 8.4 Square shop catalogue API errors
- **Error**: Product listing failing for shop feature
- **Cause**: Incorrect Square Catalogue API endpoint usage
- **Fix**: Correct API endpoint and auth headers for catalogue calls
- **Commit**: `5e2cb2c`

### 8.5 Em dash in pricing section causing build error
- **Error**: TypeScript build error — em dash (`—`) in string literal
- **Fix**: Replace em dash with regular hyphen
- **Commit**: `f0cf22c`

---

## 9. Data Storage

### 9.1 Redis to Supabase migration
- **Error**: Redis job queue was unreliable; data lost between sessions; no queryability
- **Fix**: Full migration from Upstash Redis to Supabase for all job/client data
- **Commit**: `720c7a3`

### 9.2 Supabase `metadata` jsonb field type mismatches
- **Error**: Client fields not persisting — jsonb field receiving wrong type
- **Fix**: Correct field type handling for jsonb
- **Commit**: `7450953`

### 9.3 `pricing_details` field not excluded for quote-type pricing
- **Error**: Pricing section showing empty/broken data for clients using quote-based pricing
- **Fix**: Skip `pricing_details` field when `pricingMethod` is quote type
- **Commit**: `7450953`

---

## 10. TypeScript / Build Errors

### 10.1 Stitch SDK TypeScript typing errors
- **Error**: `Property 'stitch' does not exist on type` / type errors on SDK usage
- **Fix**: Hard-fix typing; correct import/usage pattern
- **Commits**: `89955c3`, `6f1c968`

### 10.2 Replacer callback params missing types
- **Error**: TypeScript strict mode errors on `String.replace()` callback parameters in pipeline
- **Fix**: Add explicit types to all replacer callback params
- **Commits**: `8e5198`, `84b26e4`

### 10.3 `formatDate` not in scope — `BookingManager` error
- **Error**: Build error: `formatDate is not defined` in BookingManager component
- **Cause**: `formatDate` defined inside a function, not at module scope
- **Fix**: Hoist `formatDate` to module scope
- **Commit**: `f046d5b`

### 10.4 Duplicate return statement in feature-requests PATCH handler
- **Error**: TypeScript error: unreachable code after return
- **Fix**: Remove duplicate return
- **Commit**: `63a50a5`

### 10.5 Admin page missing default export
- **Error**: Next.js page not found — missing `export default`
- **Fix**: Add default export to admin page
- **Commit**: `b23d69b`

### 10.6 JSX structure errors in client portal
- **Error**: Build error: unclosed JSX elements in client portal page
- **Fix**: Fix JSX nesting and closing tags
- **Commits**: `860940f`, `dea9dc8`

### 10.7 `@types/jsdom` missing
- **Error**: TypeScript error: cannot find type definitions for jsdom
- **Fix**: Add `@types/jsdom` to devDependencies
- **Commit**: `92011fb`

---

## 11. Email (Resend)

### 11.1 Emails not sending from correct domain
- **Error**: Client receipt emails going to spam or rejected — sent from wrong domain
- **Fix**: Send all emails from `hello@webgecko.au`
- **Commit**: `c90b9d0`

### 11.2 Lead notification email missing client fields
- **Error**: Owner notification email not including all intake form fields
- **Fix**: Restore full field set in lead notification email
- **Commit**: `3c5b713`

### 11.3 HTML email attachment not working
- **Error**: Client email supposed to include site HTML as attachment — attachment not appearing
- **Fix**: Fix Resend attachment format
- **Commit**: `158ddde`

---

## 12. Client Portal

### 12.1 Client portal login fix-it route job lookup failing
- **Error**: "Fix My Site" route returning 404 / can't find client job
- **Cause**: Route was looking up by wrong identifier
- **Fix**: Correct job lookup logic
- **Commit**: `5b399b1`

### 12.2 Client portal showing AI mentions
- **Error**: Portal UI was mentioning "AI", "Claude", "Anthropic" — should be invisible tooling
- **Fix**: Remove all AI/Claude branding from client-facing portal
- **Commits**: `e924da4`, `1b56b0f`

### 12.3 Booking availability not showing after plan unlock
- **Error**: Booking tab in client portal showing no availability immediately after plan upgraded
- **Cause**: Availability config not created at unlock time
- **Fix**: Create availability config on plan unlock
- **Commit**: `66e6cec`

### 12.4 14-day login persistence not working
- **Error**: Clients being logged out after session ended (not persisting 14 days)
- **Fix**: Fix cookie `maxAge` / `expires` for 14-day persistence
- **Commit**: `e393fe2`

---

## 13. Maps Embed

### 13.1 OpenStreetMap fallback — Google Maps blocked by CSP
- **Error**: Google Maps embed blocked in some browser/CSP configurations
- **Fix**: Added OpenStreetMap as iframe fallback
- **Commit**: `25534f7`

### 13.2 Maps injection placement breaking layout
- **Error**: Map appearing in the middle of contact section, between form and address columns
- **Cause**: Injection finding wrong `</div>` to insert before
- **Fix**: Inject map after the entire contact section, not inside it
- **Commits**: `403940e`, `c43e979`

### 13.3 `google.com/maps` not in maps guard
- **Error**: Maps guard not triggering for `google.com/maps` URL variant
- **Fix**: Added `google.com/maps` to the maps URL guard pattern
- **Commit**: `f26a233`

---

## 14. Cloudinary / Images

### 14.1 Image upload payload too large
- **Error**: `413 Payload Too Large` on image upload
- **Cause**: Raw full-resolution images being uploaded without compression
- **Fix**: Client-side image compression before upload
- **Commit**: `ebcf455`

---

## 15. Turnstile CAPTCHA

### 15.1 Turnstile token timing out
- **Error**: Turnstile token expired before form submission — CAPTCHA verification failing
- **Fix**: Fix token timing — generate token closer to submission
- **Commit**: `fbec578`

### 15.2 Turnstile blocking form during domain configuration
- **Error**: Intake form unusable while Cloudflare domain was being configured
- **Fix**: Make Turnstile non-blocking — form submits even if Turnstile unavailable
- **Commit**: `097094f`

---

## 16. Multi-Page Routing

### 16.1 Multi-page JS hiding single-page sections
- **Error**: On single-page sites, multi-page navigation JS was hiding content sections
- **Cause**: Multi-page show/hide logic applied regardless of whether site was single or multi-page
- **Fix**: Detect site type; only apply multi-page toggling on multi-page sites
- **Commit**: `b3d7efc`

### 16.2 `navigateTo` target mismatch (label vs ID)
- **Error**: Clicking nav links navigated to wrong page or no page
- **Cause**: `navigateTo` targets used link text labels; page IDs were different
- **Fix**: `fixNavigateToTargets` compile-time pass rewrites onclick targets from link text to actual page IDs
- **Commit**: `273920d`

### 16.3 Multi-page rebuild/fix route breakage (4 bugs)
- **Error**: Multiple simultaneous breakages in multi-page navigation after rebuild
- **Fix**: 4-bug fix commit
- **Commit**: `c2ee433`

---

## 17. Preview / Iframe

### 17.1 Preview iframe URL encoding issue
- **Error**: Preview URL containing encoded characters that broke iframe `src`
- **Fix**: Fix Vercel encoding of preview URL value
- **Commit**: `10c9daf`

### 17.2 Preview iframe `src` using relative URL
- **Error**: Iframe `src` was a relative path — didn't work when embedded in different context
- **Fix**: Ensure iframe `src` uses absolute URL
- **Commit**: `33582a0`

### 17.3 WordPress iframe embedding blocked
- **Error**: Preview not loading when embedded in WordPress
- **Fix**: Add correct `X-Frame-Options` / CSP headers to allow iframe embedding
- **Commit**: `89955c3`

---

## 18. Miscellaneous

### 18.1 Phone number double-replacement
- **Error**: Phone number appearing twice in generated HTML
- **Cause**: Replacement regex running twice on same content
- **Fix**: Add guard to prevent double replacement
- **Commit**: `b3d7efc`

### 18.2 Business name not enforced in title tag
- **Error**: Site `<title>` tag not using client's business name
- **Fix**: Enforce business name in title tag replacement
- **Commit**: `b3d7efc`

### 18.3 FAQ accordion not functioning
- **Error**: FAQ accordion open/close not working
- **Fix**: Fix accordion JS
- **Commit**: `3cbfa43`

### 18.4 Location keyword appearing in hero copy
- **Error**: City/suburb appearing in hero headline or subheadline
- **Cause**: Pipeline injecting location keyword without placement constraints
- **Fix**: Only inject location into services section; not hero
- **Commits**: `7ed3b97`, `b4f52d6`

### 18.5 CSS threshold too strict — Stitch uses inline styles
- **Error**: Pipeline was rejecting valid Stitch HTML because CSS content was under 500 chars
- **Cause**: Stitch uses inline styles extensively; threshold was designed for `<style>` blocks
- **Fix**: Lower CSS threshold to 500 chars
- **Commit**: `933d485`

### 18.6 Tawk.to shared property across multiple clients
- **Error**: All client sites sharing a single Tawk.to property — chats from different clients mixed together
- **Fix**: Per-client Tawk.to property ID stored and injected individually
- **Commit**: `f9e9a4c`

### 18.7 Beehiiv newsletter form posting to central app
- **Error**: Newsletter signup forms calling internal WebGecko API — should post directly to Beehiiv
- **Fix**: Newsletter forms post directly to Beehiiv API
- **Commit**: `c823bd4`

### 18.8 `clientSlug` issues — wrong URL routing
- **Error**: Client portal not resolving correct client from slug
- **Fix**: Fix slug generation and lookup
- **Commit**: `ef46db1`

### 18.9 ABN field issues
- **Error**: ABN (Australian Business Number) field not saving/displaying correctly
- **Fix**: Fix ABN field handling
- **Commit**: `53d85d1`

### 18.10 Plan pricing display broken (`/` character)
- **Error**: Pricing display showing `/` in wrong place
- **Fix**: Fix pricing display format
- **Commit**: `9f70d51`

### 18.11 `stitch.ts` singleton export
- **Error**: Stitch SDK singleton not exporting correctly — `cannot find module` or undefined export
- **Fix**: Correct export syntax for Stitch SDK singleton
- **Commit**: `b4b794b`

---

## Summary Statistics

| Category | Count |
|---|---|
| Stitch SDK / MCP | 14 |
| CTA & Navigation | 8 |
| Blueprint / Prompt | 8 |
| File Corruption | 12 |
| Inngest Pipeline | 8 |
| Admin / Preview | 7 |
| SuperSaas | 6 |
| Square Payments | 5 |
| Data Storage | 3 |
| TypeScript / Build | 7 |
| Email (Resend) | 3 |
| Client Portal | 4 |
| Maps | 3 |
| Images | 1 |
| Turnstile | 2 |
| Multi-page Routing | 3 |
| Preview / Iframe | 3 |
| Miscellaneous | 11 |
| **Total** | **~118** |

---

*Last updated: 2026-05-09*
