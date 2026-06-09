// lib/dom-inject.ts
// DOM-based HTML injection using cheerio — replaces fragile regex operations.
//
// PRIME DIRECTIVE: Stitch built the site. This module ONLY:
//   1. Replaces placeholder text with real client data
//   2. Injects logo/images into existing <img> slots
//   3. Wires navigation links
//   4. Injects the booking iframe into Stitch's existing booking container
//   5. Adds structural IDs to existing sections that lack them
//   6. Injects scripts/meta into <head>
//   7. Appends what is COMPLETELY absent (contact form, footer) — never replaces

import * as cheerio from "cheerio";

// Stitch generates placeholder images from Google's CDN — two known patterns:
// Old: lh3.googleusercontent.com/aida-public/...
// New: lh3.googleusercontent.com/aida/...
function isStitchImage(src: string): boolean {
  return src.includes("lh3.googleusercontent.com/aida");
}

export interface DomInjectParams {
  html: string;
  businessName: string;
  clientEmail: string;
  clientPhone: string;
  businessAddress: string;
  logoUrl?: string;
  heroUrl?: string;
  photoUrls?: string[];
  bookingUrl?: string;
  hasBookingFeature: boolean;
  isMultiPage: boolean;
  jobId?: string;
  ga4Id?: string;
  tawktoPropertyId?: string;
  requestedPageIds?: string[];
  accentColor?: string;
}

export function domInject(params: DomInjectParams): string {
  const {
    html, businessName, clientEmail, clientPhone, businessAddress,
    logoUrl, heroUrl, photoUrls = [], bookingUrl, hasBookingFeature,
    isMultiPage, jobId, ga4Id, tawktoPropertyId, requestedPageIds = [],
    accentColor = "#10b981",
  } = params;

  const $ = cheerio.load(html, { xmlMode: false });

  // ── 1. Replace placeholder emails ────────────────────────────────────────────
  if (clientEmail) {
    $("a[href^='mailto:']").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (!href.includes(clientEmail) && !href.includes("webgecko")) {
        $(el).attr("href", `mailto:${clientEmail}`);
        // Replace visible text if it looks like an email
        const text = $(el).text().trim();
        if (text.includes("@") && !text.includes(clientEmail)) {
          $(el).text(clientEmail);
        }
      }
    });
    // Replace placeholder email text nodes
    $("body *").contents().filter((_, node) => node.type === "text").each((_, node) => {
      const text = (node as any).data as string;
      if (/\b[\w.+-]+@(example|placeholder|company|business|domain|yourname|test)\.(com|com\.au|au|net|org)\b/i.test(text)) {
        (node as any).data = text.replace(/\b[\w.+-]+@(example|placeholder|company|business|domain|yourname|test)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
      }
    });
  }

  // ── 2. Replace placeholder phones ────────────────────────────────────────────
  if (clientPhone) {
    const clientDigits = clientPhone.replace(/\D/g, "");
    $("a[href^='tel:']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const hrefDigits = href.replace(/\D/g, "");
      // Only replace obvious fake numbers (all same digit, or 000)
      if (hrefDigits !== clientDigits && (/0{4,}/.test(hrefDigits) || /(\d)\1{5,}/.test(hrefDigits))) {
        $(el).attr("href", `tel:${clientPhone}`);
        $(el).text(clientPhone);
      }
    });
  }

  // ── 3. Remove any Stitch-generated logo images from nav — show text name only ──
  // Stitch often embeds a base64 or aida placeholder logo next to the business name.
  // We remove it so the header shows only the clean text business name.
  {
    const header = $("header, nav").first();
    header.find("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      // Remove Stitch aida images and base64 placeholder logos
      if (isStitchImage(src) || src.startsWith("data:image")) {
        $(el).remove();
      }
    });
  }

  // ── 4. Replace Stitch placeholder images with client photos ──────────────────
  // Stitch generates images from lh3.googleusercontent.com/aida/ (new) or /aida-public/ (old)
  // Smart assignment: match section/card keywords against photo filenames.
  // NO cycling — each photo used once only; empty slots stay as Stitch generated them.
  if (heroUrl || photoUrls.length > 0) {
    const contentPhotos = [...photoUrls]; // hero handled separately
    const usedPhotoIndices = new Set<number>();

    // Extract keywords from a photo URL filename for matching
    function photoKeywords(url: string): string[] {
      const filename = url.split("/").pop()?.toLowerCase().replace(/[^a-z0-9]/g, " ") || "";
      return filename.split(/\s+/).filter(w => w.length > 2);
    }

    // Find best unused photo for the given context keywords, or first unused fallback
    function pickPhoto(contextKeywords: string[]): string | null {
      // 1. Try keyword match against filename
      for (let i = 0; i < contentPhotos.length; i++) {
        if (usedPhotoIndices.has(i)) continue;
        const pk = photoKeywords(contentPhotos[i]);
        if (contextKeywords.some(ck => pk.some(pk2 => pk2.includes(ck) || ck.includes(pk2)))) {
          usedPhotoIndices.add(i);
          return contentPhotos[i];
        }
      }
      // 2. First unused photo (no repeat)
      for (let i = 0; i < contentPhotos.length; i++) {
        if (!usedPhotoIndices.has(i)) {
          usedPhotoIndices.add(i);
          return contentPhotos[i];
        }
      }
      return null; // all used — leave slot as-is
    }

    // Assign heroUrl to the hero section image first
    if (heroUrl) {
      const heroImg = $("[id='home'], [id='hero'], [class*='hero'], body > section").first().find("img").first();
      if (heroImg.length && isStitchImage(heroImg.attr("src") || "")) {
        heroImg.attr("src", heroUrl).attr("loading", "lazy");
      }
    }

    $("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (!isStitchImage(src)) return;

      // Skip logo slot in header/nav
      if ($(el).closest("header, nav").length > 0) return;
      // Skip if already set to heroUrl
      if (src === heroUrl) return;

      // Build context keywords from nearest heading + alt text
      const $container = $(el).closest("section, [data-page], article, [class*='card'], [class*='service'], [class*='item'], li, div[class*='rounded']");
      const headingText = $container.find("h1, h2, h3, h4").first().text().toLowerCase();
      const altText = ($(el).attr("data-alt") || $(el).attr("alt") || "").toLowerCase();
      const contextWords = [...headingText.split(/\W+/), ...altText.split(/\W+/)]
        .filter(w => w.length > 3 && !["with","this","that","from","into","have","been","will","your","their","them","they"].includes(w));

      const photo = pickPhoto(contextWords);
      if (photo) {
        $(el).attr("src", photo).attr("loading", "lazy");
      }
    });

    // ── Replace gallery placeholder content with real client photos ──────────────
    // Stitch generates galleries in different ways — handle all patterns:
    //   1. <div class="h-64 bg-..."> placeholder divs with no img
    //   2. <p>[Project Image Placeholder N]</p> text placeholders
    //   3. <div class="aspect-[4/3]..."> aspect-ratio containers with placeholder text
    if (photoUrls.length > 0) {
      let galleryIdx = 0;
      const gallerySection = $("[id='gallery'], [data-page='gallery']").first();
      if (gallerySection.length) {

        // Pattern 1: divs/containers with placeholder text like "[Project Image Placeholder N]"
        gallerySection.find("div, p").each((_, el) => {
          const $el = $(el);
          if ($el.find("img").length > 0) return; // already has real image
          const text = $el.text().trim();
          if (!/\[.*(?:image|photo|project|gallery).*placeholder/i.test(text)) return;
          if (galleryIdx >= photoUrls.length) return; // no more photos — leave slot as-is
          const photoUrl = photoUrls[galleryIdx];
          const $parent = $el.closest(".masonry-item, [class*='gallery-item'], [class*='masonry'], div[class*='overflow-hidden'], div[class*='rounded']").first();
          if ($parent.length && $parent.find("img").length === 0) {
            $parent.html(`<img src="${photoUrl}" alt="Gallery ${galleryIdx + 1}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s;" loading="lazy">`);
          } else {
            $el.replaceWith(`<img src="${photoUrl}" alt="Gallery ${galleryIdx + 1}" style="width:100%;height:auto;display:block;" loading="lazy">`);
          }
          galleryIdx++;
        });

        // Pattern 2: height-class divs with no <img> (bg-surface-variant etc.)
        gallerySection.find("div").each((_, el) => {
          const $el = $(el);
          if ($el.find("img").length > 0) return;
          const cls = $el.attr("class") || "";
          if (!/\bh-\[|\bh-\d+\b|\bmin-h-\[|\baspect-/.test(cls)) return;
          if ($el.text().trim().length > 80) return;
          if (galleryIdx >= photoUrls.length) return; // no more photos — leave slot as-is
          const photoUrl = photoUrls[galleryIdx];
          $el.html(`<img src="${photoUrl}" alt="Gallery ${galleryIdx + 1}" class="w-full h-full object-cover" loading="lazy">`);
          galleryIdx++;
        });

        console.log(`[DomInject] Gallery: filled ${galleryIdx} placeholder slots with client photos`);
      }
    }

    console.log(`[DomInject] Replaced Stitch placeholder images. Photos used: ${usedPhotoIndices.size}/${contentPhotos.length}`);
  }

  // ── 5. Inject booking iframe ──────────────────────────────────────────────────
  if (hasBookingFeature && bookingUrl) {
    const bookingSection = $("[id='booking']").first();
    const iframeHtml = `<iframe src="${bookingUrl}" width="100%" height="800" frameborder="0" scrolling="auto" style="display:block;background:#fff;border:none;min-height:700px;" title="Book an Appointment" loading="lazy"></iframe>`;

    if (bookingSection.length) {
      // If real iframe already present and working, leave it
      const hasRealIframe = bookingSection.find(`iframe[src*="supersaas.com"]`).filter((_, el) => {
        return !($(el).attr("src") || "").includes("/template");
      }).length > 0;
      if (hasRealIframe) {
        console.log("[DomInject] Real booking iframe already present — skipping");
      } else {

      // Remove stray template iframes and placeholders
      bookingSection.find(`iframe[src*="/template"]`).remove();
      bookingSection.find(`iframe[src*="supersaas"]`).remove();

      // Find and replace Stitch's booking placeholder — the full container, not just inner text
      let injected = false;

      // Strategy 1: find the min-h container div (Stitch's standard booking placeholder pattern)
      // This matches divs with min-h classes OR containing placeholder text/icons
      bookingSection.find("div").each((_, el) => {
        if (injected) return;
        const $el = $(el);
        const classAttr = $el.attr("class") || "";
        const innerHtml = $el.html() || "";
        const innerText = $el.text().trim();

        const isPlaceholder =
          /min-h-\[/.test(classAttr) ||  // has min-h-[Npx] Tailwind class = Stitch placeholder
          /booking.*widget|booking.*loading|booking.*iframe|iframe.*placeholder|\[\s*booking/i.test(innerText) ||
          /calendar_month|calendar-month/.test(innerHtml);

        if (isPlaceholder) {
          // Replace the entire placeholder with the iframe at full size
          $el.replaceWith(`<div style="width:100%;border-radius:12px;overflow:hidden;background:#fff;">${iframeHtml}</div>`);
          injected = true;
          console.log("[DomInject] Replaced Stitch booking placeholder container with iframe");
        }
      });

      // Strategy 2: named containers
      if (!injected) {
        const named = bookingSection.find("#booking-iframe-container, [class*='booking-placeholder'], [class*='iframe-placeholder']").first();
        if (named.length) {
          named.replaceWith(`<div style="width:100%;border-radius:12px;overflow:hidden;background:#fff;">${iframeHtml}</div>`);
          injected = true;
        }
      }

      // Strategy 3: append to the section's main content div
      if (!injected) {
        const mainDiv = bookingSection.find("> div").first();
        if (mainDiv.length) {
          mainDiv.append(`<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;background:#fff;">${iframeHtml}</div>`);
        } else {
          bookingSection.append(`<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;background:#fff;">${iframeHtml}</div>`);
        }
      }
      console.log(`[DomInject] Booking iframe injected. url=${bookingUrl}`);
      } // end else (no real iframe)
    } else {
      // No booking section — append a minimal one before footer
      const bookingWrap = `<section id="booking" style="padding:60px 24px;text-align:center;"><h2 style="margin-bottom:16px;">Book an Appointment</h2>${iframeHtml}</section>`;
      $("footer").before(bookingWrap);
      console.log(`[DomInject] Booking section created (Stitch had none).`);
    }
  }

  // ── 6. Wire navigation links ─────────────────────────────────────────────────
  // Replace href="#section" and bare href="#" nav links with navigateTo() calls
  const navLinkMap: Record<string, string> = {
    "home": "home", "about": "about", "about us": "about",
    "services": "services", "our services": "services",
    "gallery": "gallery", "portfolio": "gallery", "our work": "gallery",
    "contact": "contact", "contact us": "contact", "get in touch": "contact",
    "faq": "faq", "faqs": "faq",
    "pricing": "pricing", "packages": "pricing",
    "shop": "shop", "store": "shop",
    "booking": "booking", "book now": "booking", "book": "booking",
    "testimonials": "testimonials", "reviews": "testimonials",
    "blog": "blog", "team": "team",
  };

  $("header a, nav a, [class*='nav'] a, [class*='header'] a").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const onclick = $el.attr("onclick") || "";

    // Skip if already wired, external, or tel/mailto
    if (onclick.includes("navigateTo") || /^(https?:|mailto:|tel:)/.test(href)) return;

    const text = $el.text().trim().toLowerCase();
    const fragment = href.startsWith("#") ? href.slice(1).toLowerCase() : "";

    // Resolve target from text or fragment
    let target = navLinkMap[text] ||
      Object.entries(navLinkMap).find(([k]) => text.includes(k))?.[1] ||
      navLinkMap[fragment] ||
      Object.entries(navLinkMap).find(([k]) => fragment.includes(k))?.[1] ||
      fragment;

    if (!target) return;

    // Only wire if target section actually exists in DOM
    if (!$(`[id="${target}"], [data-page="${target}"]`).length) return;

    $el.attr("href", "#");
    $el.attr("onclick", `event.preventDefault();window.navigateTo&&window.navigateTo('${target}')`);
  });

  // ── 6b. Rewire CTA buttons to booking when client has a booking service ─────────
  // "Get a Quote", "Get Free Quote", "Book Now", "Book an Appointment", "Request a Quote" etc.
  // should always go to #booking (not #contact) when the client has a booking system.
  if (hasBookingFeature && $("[id='booking'], [data-page='booking']").length) {
    const ctaRe = /^(?:get\s+(?:a\s+)?(?:free\s+)?quote|book\s+(?:now|a(?:n appointment)?)?|request\s+(?:a\s+)?quote|schedule\s+(?:an?\s+)?appointment|get\s+started|contact\s+us\s+today)$/i;
    $("a, button").each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (!ctaRe.test(text)) return;
      // Only rewire if currently pointing to contact or bare #
      const href = $el.attr("href") || "";
      const onclick = $el.attr("onclick") || "";
      const pointsToContact = href.includes("contact") || onclick.includes("'contact'") || onclick.includes('"contact"');
      const isUnwired = href === "#" && !onclick.includes("navigateTo");
      if (!pointsToContact && !isUnwired) return;
      $el.attr("href", "#");
      $el.attr("onclick", `event.preventDefault();window.navigateTo&&window.navigateTo('booking')`);
    });
    console.log("[DomInject] CTA buttons rewired to #booking");
  }

  // ── 7. Stamp id="hero" on first section if missing ───────────────────────────
  if (!$("[id='hero']").length) {
    const firstSection = $("body section").first();
    if (firstSection.length) {
      const existingId = firstSection.attr("id");
      if (existingId) {
        // Rename existing id to "hero" only if it's a generic/home id
        if (/^(home|hero|banner|landing|top|main)$/i.test(existingId)) {
          firstSection.attr("id", "hero");
        }
        // Otherwise leave it — don't rename meaningful IDs
      } else {
        firstSection.attr("id", "hero");
      }
    }
  }

  // ── 8. Inject WG_IS_MULTIPAGE + navigateTo script ────────────────────────────
  const hasNavigateTo = $("script").filter((_, el) => $(el).html()?.includes("window.navigateTo =") || false).length > 0;
  if (!hasNavigateTo) {
    const navigateToScript = buildNavigateToScript(isMultiPage, jobId);
    $("body").append(navigateToScript);
  }

  // ── 9. Inject GA4 if provided ────────────────────────────────────────────────
  if (ga4Id && !html.includes(ga4Id)) {
    $("head").append(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>`);
    $("head").append(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`);
  }

  // ── 10. Inject Tawk.to if provided ───────────────────────────────────────────
  if (tawktoPropertyId && !html.includes("tawk.to")) {
    $("body").append(`<script type="text/javascript">var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${tawktoPropertyId}/default';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();</script>`);
  }

  // ── 11. Inject WG_JOB global ─────────────────────────────────────────────────
  if (jobId && !html.includes("WG_JOB")) {
    $("head").append(`<script>window.WG_JOB="${jobId}";</script>`);
  }

  // ── 12. Wire Privacy/Terms footer links ──────────────────────────────────────
  $("footer a, [id='footer'] a, [class*='footer'] a").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim().toLowerCase();
    const onclick = $el.attr("onclick") || "";
    if (onclick.includes("navigateTo")) return;

    if (/privacy/i.test(text)) {
      $el.attr("onclick", "event.preventDefault();window.navigateTo&&window.navigateTo('privacy')");
      $el.attr("href", "#");
    } else if (/terms/i.test(text)) {
      $el.attr("onclick", "event.preventDefault();window.navigateTo&&window.navigateTo('terms')");
      $el.attr("href", "#");
    }
  });

  // ── 13. Replace aida-public URLs in CSS background-image (inline styles) ───────
  // Stitch often uses `style="background-image: url('aida...')"` for hero/section
  // backgrounds. Cheerio <img> replacement above misses these entirely.
  let out = $.html();
  if (heroUrl || photoUrls.length > 0) {
    let bgIdx = 0;
    out = out.replace(
      /background-image:\s*url\(['"]?(https:\/\/lh3\.googleusercontent\.com\/aida[^'")\s]*?)['"]?\)/gi,
      () => {
        if (heroUrl && bgIdx === 0) { bgIdx++; return `background-image: url('${heroUrl}')`; }
        const url = photoUrls[bgIdx < photoUrls.length ? bgIdx : photoUrls.length - 1];
        bgIdx++;
        return `background-image: url('${url || heroUrl || ""}')`;
      }
    );
  }
  return out;
}

// ── navigateTo script ─────────────────────────────────────────────────────────
function buildNavigateToScript(isMultiPage: boolean, jobId?: string): string {
  return `<script>
(function(){
window.WG_IS_MULTIPAGE=${isMultiPage};
${jobId ? `window.WG_JOB="${jobId}";` : ""}
window.navigateTo=function(pageId){
  // Close mobile drawer
  var drawer=document.getElementById("mobile-menu")||document.getElementById("side-drawer")||document.getElementById("mobile-nav");
  if(drawer){drawer.style.display="none";drawer.classList.add("hidden");}

  // Single-page: legal pages are overlay modals
  if(!window.WG_IS_MULTIPAGE&&(pageId==="privacy"||pageId==="terms")){
    var overlay=document.getElementById(pageId);
    if(overlay){overlay.style.display="block";return;}
  }

  // Multi-page: fade transition
  if(window.WG_IS_MULTIPAGE){
    var current=document.querySelector("[data-page].active");
    var target=document.querySelector("[data-page='"+pageId+"']")||document.getElementById(pageId);
    if(!target||target===current)return;
    if(current){
      current.style.opacity="0";
      setTimeout(function(){
        current.classList.remove("active");
        target.classList.add("active");
        target.style.opacity="0";
        requestAnimationFrame(function(){requestAnimationFrame(function(){target.style.opacity="1";});});
        window.scrollTo({top:0,behavior:"smooth"});
      },200);
    }else{
      document.querySelectorAll("[data-page]").forEach(function(s){s.classList.remove("active");});
      target.classList.add("active");
      window.scrollTo({top:0,behavior:"smooth"});
    }
    // Update nav active states
    document.querySelectorAll("nav a,header a").forEach(function(link){
      var oc=link.getAttribute("onclick")||"";
      var isActive=oc.includes("'"+pageId+"'")||oc.includes('"'+pageId+'"');
      link.style.fontWeight=isActive?"700":"";
    });
    return;
  }

  // Single-page: smooth scroll
  if(pageId==="home"||pageId==="top"){window.scrollTo({top:0,behavior:"smooth"});return;}
  var el=document.getElementById(pageId);
  if(el){el.scrollIntoView({behavior:"smooth",block:"start"});}
};

// Multi-page init: show first page, hide rest
if(window.WG_IS_MULTIPAGE){
  var pages=document.querySelectorAll("[data-page]");
  if(pages.length>1){
    var active=document.querySelector("[data-page].active");
    if(!active){
      pages[0].classList.add("active");
    }
  }
}

// Wire hamburger
document.querySelectorAll("#hamburger,#menu-toggle,#mobile-menu-btn,[aria-label='Open menu'],[aria-label='Menu']").forEach(function(btn){
  var oc=btn.getAttribute("onclick")||"";
  if(oc&&!oc.includes("toggleMobileMenu"))return;
  btn.addEventListener("click",function(){
    var d=document.getElementById("mobile-menu")||document.getElementById("side-drawer")||document.getElementById("mobile-nav");
    if(!d)return;
    var isHidden=d.style.display==="none"||d.classList.contains("hidden");
    d.style.display=isHidden?"block":"none";
    if(isHidden)d.classList.remove("hidden"); else d.classList.add("hidden");
  });
});
})();
</script>`;
}
