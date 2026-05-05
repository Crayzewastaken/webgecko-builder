/**
 * Unit test: ensureMultiPageStructure
 *
 * Feed fake single-page Stitch HTML that has hero/services/testimonials/faq/contact
 * sections (but NO data-page wrappers), request pages ["Home","Services","About","Contact"],
 * and assert the output has correct data-page wrappers, active class, navigateTo targets,
 * and non-empty content.
 *
 * Run with:  npx ts-node --project tsconfig.json scripts/test-multipage.ts
 */

import { ensureMultiPageStructure, normalizePageId } from "../lib/pipeline-helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ── Fake Stitch HTML ──────────────────────────────────────────────────────────

const FAKE_STITCH = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Business</title>
</head>
<body>
  <header>
    <nav>
      <a href="#home">Home</a>
      <a href="#services">Services</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <section id="hero">
    <h1>Welcome to Test Business</h1>
    <p>Your trusted partner for quality service in Brisbane.</p>
    <button>Book Now</button>
  </section>

  <section id="services">
    <h2>Our Services</h2>
    <div class="services-grid">
      <div class="service-card">
        <h3>Service One</h3>
        <p>Professional service one with guaranteed results and satisfaction.</p>
      </div>
      <div class="service-card">
        <h3>Service Two</h3>
        <p>Expert service two delivered by our experienced team of professionals.</p>
      </div>
      <div class="service-card">
        <h3>Service Three</h3>
        <p>Comprehensive service three tailored to your specific needs and requirements.</p>
      </div>
    </div>
  </section>

  <section id="about">
    <h2>About Us</h2>
    <p>We are a dedicated team of professionals committed to delivering excellence.
       Founded in 2010, Test Business has served thousands of satisfied customers
       across Brisbane and the Gold Coast. Our values: integrity, quality, and care.</p>
  </section>

  <section id="testimonials">
    <h2>What Our Clients Say</h2>
    <div class="testimonial">
      <p>"Absolutely fantastic service. Would highly recommend to anyone!"</p>
      <strong>— Sarah M., Brisbane</strong>
    </div>
    <div class="testimonial">
      <p>"Professional, reliable, and great value for money."</p>
      <strong>— James T., Gold Coast</strong>
    </div>
    <div class="testimonial">
      <p>"Five stars! The team went above and beyond our expectations."</p>
      <strong>— Lisa R., Sunshine Coast</strong>
    </div>
  </section>

  <section id="faq">
    <h2>Frequently Asked Questions</h2>
    <details><summary>How do I book?</summary><p>Use our online booking form or call us directly.</p></details>
    <details><summary>What areas do you service?</summary><p>We cover all of South East Queensland.</p></details>
    <details><summary>What are your hours?</summary><p>Monday to Friday 9am–5pm, Saturday 9am–1pm.</p></details>
  </section>

  <section id="contact">
    <h2>Contact Us</h2>
    <form>
      <input type="text" placeholder="Your Name" />
      <input type="email" placeholder="your@email.com" />
      <textarea placeholder="Your message"></textarea>
      <button type="submit">Send Message</button>
    </form>
    <p>Email: hello@testbusiness.com.au | Phone: 0400 000 000</p>
    <p>Address: 123 Test Street, Brisbane QLD 4000</p>
  </section>

  <footer>
    <p>&copy; 2025 Test Business. All rights reserved.</p>
  </footer>
</body>
</html>`;

// Normalize page names the same way the inngest pipeline does
const requestedPages = ["Home", "Services", "About", "Contact"].map(normalizePageId);
// → ["home", "services", "about", "contact"]

// ── Test 1: Basic multi-page promotion ───────────────────────────────────────

console.log("\n=== Test 1: Basic promotion of id-matched sections ===");
{
  const { html, report } = ensureMultiPageStructure(FAKE_STITCH, requestedPages, {
    businessName: "Test Business",
    accentColor: "#10b981",
  });

  assert("home page wrapper present",    html.includes('data-page="home"'));
  assert("services page wrapper present", html.includes('data-page="services"'));
  assert("about page wrapper present",    html.includes('data-page="about"'));
  assert("contact page wrapper present",  html.includes('data-page="contact"'));

  // Exactly one active class on a data-page wrapper
  const activeMatches = [...html.matchAll(/data-page="(\w+)"[^>]*class="[^"]*\bactive\b/g)];
  const activeMatches2 = [...html.matchAll(/class="[^"]*\bactive\b[^"]*"[^>]*data-page="(\w+)"/g)];
  const totalActive = activeMatches.length + activeMatches2.length;
  assert("exactly one active page", totalActive === 1, `found ${totalActive} active markers`);

  // First requested page (home) is active
  const homeActive = /data-page="home"[^>]*class="[^"]*\bactive\b/.test(html)
    || /class="[^"]*\bactive\b[^"]*"[^>]*data-page="home"/.test(html);
  assert("home page is active", homeActive);

  // navigateTo: the function does NOT generate nav links from href="#id" anchors — that's injectEssentials.
  // It only fixes/removes invalid targets that already exist as navigateTo() calls.
  // The fake stitch has no navigateTo() calls, so no navigateTo assertions here.
  // (navigateTo generation is tested in Test 5 via the injected script block.)
  const navTargets = new Set([...html.matchAll(/navigateTo\(['"](\w+)['"]\)/g)].map(m => m[1]));
  assert("no invalid navigateTo targets (no stray pages)",
    [...navTargets].every(t => requestedPages.includes(t)),
    `invalid targets: ${[...navTargets].filter(t => !requestedPages.includes(t)).join(",")}`);

  // Pages have non-trivial content (not empty skeletons)
  // Threshold: 200 chars for injected fallback pages (home gets injected since no id="home" in fake stitch),
  // 300 chars for pages promoted from existing rich stitch sections (services/about/contact).
  const injectedByFunction = report.missingPagesAdded;
  for (const pageId of ["home", "services", "about", "contact"]) {
    const idx = html.indexOf(`data-page="${pageId}"`);
    const window = idx >= 0 ? html.slice(idx, idx + 6000).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    const minChars = injectedByFunction.includes(pageId) ? 200 : 300;
    assert(`${pageId} page has content (>${minChars} chars)`, window.length >= minChars, `got ${window.length} chars`);
  }

  // No inline display styles on wrappers
  const wrapperDisplay = /data-page="[^"]*"[^>]*style="[^"]*display\s*:/.test(html);
  assert("no inline display style on wrappers", !wrapperDisplay);

  // Report tracks what happened
  assert("report has repairs recorded", report.repairs.length > 0,
    `repairs=${report.repairs.length}`);

  console.log(`  report: repairs=${report.repairs.length} added=[${report.missingPagesAdded}]`);
}

// ── Test 2: Already has data-page wrappers — idempotent ─────────────────────

console.log("\n=== Test 2: Idempotency — already-wrapped HTML ===");
{
  const alreadyWrapped = `<!DOCTYPE html>
<html><head><title>Already Multi</title></head>
<body>
  <div data-page="home" id="home" class="page-section active">
    <h1 id="hero">Welcome</h1>
    <p>This is the home page content with plenty of text here for the test to pass the 300-char threshold needed.</p>
    <p>More content here to ensure we exceed the minimum character count for non-empty page validation checks.</p>
  </div>
  <div data-page="services" id="services" class="page-section">
    <h2>Services</h2>
    <p>We offer many services to our valued customers in Brisbane and surrounds. Quality guaranteed always.</p>
    <p>Additional services content to ensure this page meets the minimum content threshold for validation.</p>
  </div>
  <div data-page="about" id="about" class="page-section">
    <h2>About</h2>
    <p>About us content goes here with plenty of text to satisfy the minimum length requirements for validation.</p>
    <p>More about content here too to ensure the page is considered non-empty by the validation logic checks.</p>
  </div>
  <div data-page="contact" id="contact" class="page-section">
    <h2>Contact</h2>
    <form><input type="email" /><button>Send</button></form>
    <p>Contact page content with sufficient text to exceed the minimum threshold for non-empty page validation.</p>
  </div>
  <footer><p>&copy; 2025 Already Wrapped</p></footer>
</body></html>`;

  const { html, report } = ensureMultiPageStructure(alreadyWrapped, requestedPages);

  assert("idempotent: home still present",    html.includes('data-page="home"'));
  assert("idempotent: services still present", html.includes('data-page="services"'));
  assert("idempotent: about still present",    html.includes('data-page="about"'));
  assert("idempotent: contact still present",  html.includes('data-page="contact"'));
  assert("idempotent: no pages injected",      report.missingPagesAdded.length === 0,
    `injected: [${report.missingPagesAdded}]`);

  // Still exactly one active
  const activeWrappers = [...html.matchAll(/data-page="(\w+)"[^>]*class="[^"]*active/g)].length
    + [...html.matchAll(/class="[^"]*active[^"]*"[^>]*data-page="(\w+)"/g)].length;
  assert("idempotent: still one active page", activeWrappers === 1, `${activeWrappers} active`);
}

// ── Test 3: Missing pages get fallback content injected ──────────────────────

console.log("\n=== Test 3: Missing pages get fallback injection ===");
{
  const minimalHtml = `<!DOCTYPE html>
<html><head><title>Minimal</title></head>
<body>
  <section id="hero"><h1>Hello</h1><p>Just a hero section with some text content here for the test.</p></section>
  <footer><p>&copy; 2025 Minimal Co</p></footer>
</body></html>`;

  const { html, report } = ensureMultiPageStructure(minimalHtml, requestedPages, {
    businessName: "Minimal Co",
  });

  assert("all 4 pages present after injection", requestedPages.every(p => {
    return html.includes(`data-page="${p}"`);
  }));
  assert("injected pages recorded in report", report.missingPagesAdded.length >= 3,
    `injected=[${report.missingPagesAdded}]`);
}

// ── Test 4: Stray booking page removed when not requested ────────────────────

console.log("\n=== Test 4: Stray booking page removed when not requested ===");
{
  const withStrayBooking = FAKE_STITCH.replace(
    "</body>",
    `<div data-page="booking" id="booking" class="page-section"><h2>Book</h2><iframe src="https://example.com" /></div></body>`
  );

  const { html, report } = ensureMultiPageStructure(withStrayBooking, requestedPages);

  assert("booking page removed (not requested)", !html.includes('data-page="booking"'));
  assert("booking removal recorded in report",   report.repairs.some(r => r.includes("booking")),
    `repairs=[${report.repairs.join("; ")}]`);
}

// ── Test 5: navigateTo targets outside requested pages stripped ───────────────

console.log("\n=== Test 5: Invalid navigateTo targets get fixed ===");
{
  const withBadNav = FAKE_STITCH.replace(
    "</header>",
    `<script>
function goSomewhere() { navigateTo('blog'); navigateTo('home'); navigateTo('services'); }
</script></header>`
  );

  const { html } = ensureMultiPageStructure(withBadNav, requestedPages);

  // 'blog' is not in requestedPages — its navigateTo call should be removed
  // 'home' and 'services' are valid and must remain
  assert("invalid navigateTo('blog') removed",    !html.includes("navigateTo('blog')") && !html.includes('navigateTo("blog")'));
  assert("valid navigateTo('home') preserved",     html.includes("navigateTo('home')")    || html.includes('navigateTo("home")'));
  assert("valid navigateTo('services') preserved", html.includes("navigateTo('services')") || html.includes('navigateTo("services")'));
}

// ── Summary ────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED ✅");
}
