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
  socialLinks?: { facebookPage?: string; instagramUrl?: string; linkedinUrl?: string; tiktokUrl?: string; youtubeUrl?: string };
  abn?: string;
  customHeadHtml?: string;
  customBodyHtml?: string;
  customFooterHtml?: string;
  privacyPageHtml?: string;
  termsPageHtml?: string;
  cookiePageHtml?: string;
}

export function domInject(params: DomInjectParams): string {
  const {
    html, businessName, clientEmail, clientPhone, businessAddress,
    logoUrl, heroUrl, photoUrls = [], bookingUrl, hasBookingFeature,
    isMultiPage, jobId, ga4Id, tawktoPropertyId, requestedPageIds = [],
    accentColor = "#10b981", socialLinks = {}, abn = "",
    customHeadHtml = "", customBodyHtml = "", customFooterHtml = "",
    privacyPageHtml = "", termsPageHtml = "", cookiePageHtml = "",
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
  // usedPhotoIndices is hoisted so bg-image replacement (step 13) can also avoid re-using photos.
  const contentPhotos = [...photoUrls]; // hero handled separately
  const usedPhotoIndices = new Set<number>();
  if (heroUrl || photoUrls.length > 0) {

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
      const $heroSection = $("[id='home'], [id='hero'], [class*='hero'], body > section").first();
      const heroImg = $heroSection.find("img").first();
      if (heroImg.length && isStitchImage(heroImg.attr("src") || "")) {
        const heroHeading = $heroSection.find("h1, h2").first().text().trim() || businessName;
        heroImg.attr("src", heroUrl).attr("alt", heroHeading).attr("loading", "lazy");
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
        const altForPhoto = headingText.trim()
          ? `${businessName} - ${headingText.trim().slice(0, 60)}`
          : businessName;
        $(el).attr("src", photo).attr("alt", altForPhoto).attr("loading", "lazy");
      } else if (isStitchImage($(el).attr("src") || "")) {
        // No client/Pexels photo left — remove the aida AI placeholder entirely
        // rather than leaving a perfect render that looks obviously AI-generated.
        $(el).remove();
      }
    });

    // ── Replace gallery placeholder content with real client photos ──────────────
    // Stitch generates galleries in different ways — handle all patterns:
    //   1. <div class="h-64 bg-..."> placeholder divs with no img
    //   2. <p>[Project Image Placeholder N]</p> text placeholders
    //   3. <div class="aspect-[4/3]..."> aspect-ratio containers with placeholder text
    if (photoUrls.length > 0) {
      let gallerySlot = 0;
      // Gallery cycles through client photos when the unique pool is exhausted.
      // NEVER deletes Stitch-designed slots — the gallery should always fill every slot.
      let galleryCycleIdx = 0;
      function pickGalleryPhoto(): string | null {
        if (contentPhotos.length === 0) return null;
        const fromPool = pickPhoto([]); // prefer unique
        if (fromPool) return fromPool;
        // Unique pool exhausted — cycle through client photos so no slot goes empty
        const photo = contentPhotos[galleryCycleIdx % contentPhotos.length];
        galleryCycleIdx++;
        return photo;
      }

      const gallerySection = $("[id='gallery'], [data-page='gallery']").first();
      if (gallerySection.length) {

        // Pattern 1: divs/containers with placeholder text like "[Project Image Placeholder N]"
        gallerySection.find("div, p").each((_, el) => {
          const $el = $(el);
          if ($el.find("img").length > 0) {
            // Existing img — replace if it's a Stitch aida AI placeholder
            const $img = $el.find("img").first();
            if (isStitchImage($img.attr("src") || "")) {
              const replacement = pickGalleryPhoto();
              if (replacement) { $img.attr("src", replacement).attr("loading", "lazy"); gallerySlot++; }
              else { $img.remove(); }
            }
            return;
          }
          const text = $el.text().trim();
          if (!/\[.*(?:image|photo|project|gallery).*placeholder/i.test(text)) return;
          const photoUrl = pickGalleryPhoto();
          if (!photoUrl) return; // no photos at all — leave as-is
          const $parent = $el.closest(".masonry-item, [class*='gallery-item'], [class*='masonry'], div[class*='overflow-hidden'], div[class*='rounded']").first();
          gallerySlot++;
          if ($parent.length && $parent.find("img").length === 0) {
            $parent.html(`<img src="${photoUrl}" alt="${businessName} - project ${gallerySlot}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s;" loading="lazy">`);
          } else {
            $el.replaceWith(`<img src="${photoUrl}" alt="${businessName} - project ${gallerySlot}" style="width:100%;height:auto;display:block;" loading="lazy">`);
          }
        });

        // Pattern 2: height/aspect-ratio placeholder divs with no <img>
        gallerySection.find("div").each((_, el) => {
          const $el = $(el);
          if ($el.find("img").length > 0) {
            const $img = $el.find("img").first();
            if (isStitchImage($img.attr("src") || "")) {
              const replacement = pickGalleryPhoto();
              if (replacement) { $img.attr("src", replacement).attr("loading", "lazy"); gallerySlot++; }
              else { $img.remove(); }
            }
            return;
          }
          const cls = $el.attr("class") || "";
          if (!/\bh-\[|\bh-\d+\b|\bmin-h-\[|\baspect-/.test(cls)) return;
          if ($el.text().trim().length > 80) return;
          const photoUrl = pickGalleryPhoto(); // cycle if needed — never delete the slot
          if (!photoUrl) return; // no photos at all — leave as-is
          gallerySlot++;
          $el.html(`<img src="${photoUrl}" alt="${businessName} - project ${gallerySlot}" class="w-full h-full object-cover" loading="lazy">`);
        });

        // Sweep: replace any remaining aida AI placeholder images
        gallerySection.find("img").each((_, el) => {
          const src = $(el).attr("src") || "";
          if (isStitchImage(src)) {
            const replacement = pickGalleryPhoto();
            if (replacement) { $(el).attr("src", replacement).attr("loading", "lazy"); }
            else { $(el).remove(); }
          }
        });

        // Sweep: fill any remaining branded text-placeholders (e.g. "MASTEREDGE #7")
        // but only replace with photo — never delete the slot structure
        gallerySection.find("div").each((_, el) => {
          const $el = $(el);
          if ($el.find("img").length > 0) return;
          const cls = $el.attr("class") || "";
          if (!/\bh-\[|\bh-\d+\b|\bmin-h-\[|\baspect-/.test(cls)) return;
          const text = $el.text().trim();
          if (text.length === 0 || text.length > 80) return;
          const photoUrl = pickGalleryPhoto();
          if (photoUrl) {
            gallerySlot++;
            $el.html(`<img src="${photoUrl}" alt="${businessName} - project ${gallerySlot}" class="w-full h-full object-cover" loading="lazy">`);
          }
          // If still no photo (contentPhotos empty), leave div — at least no aida image
        });

        // ── Normalize gallery layout to an even professional grid ─────────────────
        // Stitch often uses CSS columns (masonry) which creates uneven column heights.
        // We switch to a uniform CSS grid and enforce a consistent aspect ratio on every
        // cell so the portfolio always looks balanced regardless of source image dimensions.
        const galleryGrid = gallerySection.find("[class*='columns-']").first();
        if (galleryGrid.length) {
          // Replace masonry columns with a uniform grid
          const cls = galleryGrid.attr("class") || "";
          const evenGridCls = cls
            .replace(/\bcolumns-\S+/g, "")          // strip all columns-* classes
            .replace(/\bspace-y-\S+/g, "")          // strip space-y-* (incompatible with grid)
            .trim()
            + " grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4";
          galleryGrid.attr("class", evenGridCls.replace(/\s+/g, " "));

          // Normalize every cell to a consistent 4:3 aspect ratio with object-cover
          galleryGrid.children().each((_, el) => {
            const $cell = $(el);
            const $img = $cell.find("img").first();
            if (!$img.length) return;
            // Remove break-inside-avoid (irrelevant in grid), enforce aspect-ratio container
            const cellCls = ($cell.attr("class") || "")
              .replace(/\bbreak-inside-avoid\b/g, "")
              .replace(/\bh-\d+\b|\bh-\[.*?\]/g, "")  // strip explicit heights
              .trim();
            $cell.attr("class", (cellCls + " relative aspect-[4/3] overflow-hidden rounded-xl").replace(/\s+/g, " "));
            // Make image fill the cell
            const imgCls = ($img.attr("class") || "").replace(/\bw-full\b|\brounded-xl\b/g, "").trim();
            $img.attr("class", (imgCls + " absolute inset-0 w-full h-full object-cover").replace(/\s+/g, " "));
          });
        }

        console.log(`[DomInject] Gallery: filled ${gallerySlot} placeholder slots with client photos`);
      }
    }

    console.log(`[DomInject] Replaced Stitch placeholder images. Photos used: ${usedPhotoIndices.size}/${contentPhotos.length}`);
  }

  // ── 5. Inject booking iframe ──────────────────────────────────────────────────
  // Dynamic injection via a <script> appended to <body> so Termly's DOM scan never intercepts it.
  // URL stored in a data-attribute (HTML-encoded) to avoid JS string escaping issues.
  if (hasBookingFeature && bookingUrl) {
    const bookingSection = $("[id='booking']").first();
    const safeUrl = bookingUrl.includes("?") ? bookingUrl : `${bookingUrl}?kiosk=1`;

    const containerDiv = `<div id="wg-booking-container" data-wg-url="${safeUrl}" style="width:100%;min-height:600px;overflow:visible;background:#f8fafc;border-radius:12px;"><p style="color:#94a3b8;font-size:14px;padding:24px;">Loading booking calendar…</p></div>`;

    if (bookingSection.length) {
      // Ensure data-page="booking" is set on the section so multi-page CSS hides it correctly.
      if (isMultiPage && !bookingSection.attr("data-page")) {
        bookingSection.attr("data-page", "booking");
      }
      // Strip max-width and overflow constraints from section and its direct inner div.
      // Stitch typically wraps section content in <div class="max-w-2xl mx-auto ..."> which
      // narrows the booking iframe to ~550px on desktop. We expand it to full width.
      const secStyle = (bookingSection.attr("style") || "").replace(/overflow\s*:\s*[^;]+;?/gi, "").trim();
      bookingSection.attr("style", secStyle ? secStyle + ";overflow:visible;" : "overflow:visible;");
      const secClass = (bookingSection.attr("class") || "").replace(/\boverflow-hidden\b|\boverflow-auto\b|\boverflow-scroll\b/g, "overflow-visible");
      bookingSection.attr("class", secClass);
      // Expand the inner container div — remove Tailwind max-w-* and replace with max-w-none.
      bookingSection.find("> div").each((_, el) => {
        const $el = $(el);
        const cls = ($el.attr("class") || "")
          .replace(/\bmax-w-\S+/g, "max-w-none")
          .replace(/\boverflow-hidden\b|\boverflow-auto\b|\boverflow-scroll\b/g, "overflow-visible");
        $el.attr("class", cls);
        const divStyle = ($el.attr("style") || "").replace(/overflow\s*:\s*[^;]+;?/gi, "").replace(/max-width\s*:\s*[^;]+;?/gi, "").trim();
        $el.attr("style", divStyle ? divStyle + ";overflow:visible;max-width:none;" : "overflow:visible;max-width:none;");
      });
      // Global cleanup — remove ALL SuperSaaS iframes and booking containers from the
      // entire document, not just within this section, so Stitch's stray iframes don't
      // produce a duplicate calendar alongside the injected one.
      $(`iframe[src*="supersaas"]`).remove();
      $(`iframe[src*="/template"]`).remove();
      $(`#wg-booking-container`).remove();
      $("script").filter((_, el) => !!($(el).html()?.includes("wg-booking-container"))).remove();
      // Remove accumulated empty strategy-3 wrapper divs (each Fix run previously left one behind).
      bookingSection.find("div").filter((_, el) => {
        const $el = $(el);
        return ($el.attr("style") || "").includes("margin-top:24px") && $el.children().length === 0 && $el.text().trim() === "";
      }).remove();

      let injected = false;

      // Strategy 1: Stitch placeholder div (min-h class or placeholder text/icon)
      bookingSection.find("div").each((_, el) => {
        if (injected) return;
        const $el = $(el);
        const classAttr = $el.attr("class") || "";
        const innerHtml = $el.html() || "";
        const innerText = $el.text().trim();
        const isPlaceholder =
          /min-h-\[/.test(classAttr) ||
          /booking.*widget|booking.*loading|booking.*iframe|iframe.*placeholder|\[\s*booking/i.test(innerText) ||
          /calendar_month|calendar-month/.test(innerHtml);
        if (isPlaceholder) {
          $el.replaceWith(containerDiv);
          injected = true;
        }
      });

      // Strategy 2: named containers
      if (!injected) {
        const named = bookingSection.find("#booking-iframe-container, [class*='booking-placeholder'], [class*='iframe-placeholder']").first();
        if (named.length) { named.replaceWith(containerDiv); injected = true; }
      }

      // Strategy 3: append to section
      if (!injected) {
        const mainDiv = bookingSection.find("> div").first();
        (mainDiv.length ? mainDiv : bookingSection).append(`<div style="margin-top:24px;">${containerDiv}</div>`);
      }
    } else {
      // No booking section — create one before footer.
      const dpAttr = isMultiPage ? ` data-page="booking"` : ``;
      $("footer").before(`<section id="booking"${dpAttr} style="padding:24px;text-align:center;"><h2 style="margin-bottom:8px;">Book an Appointment</h2><p style="margin-bottom:16px;">Select a date and time that works for you</p>${containerDiv}</section>`);
    }

    console.log(`[DomInject] Booking dynamic script injected. url=${safeUrl}`);
  }

  // ── 5b. Replace static Google Maps iframes with Shadow DOM containers ─────────
  // Termly blocks google.com/maps iframes. Replace with data-attribute containers;
  // the loader script below will init them via Shadow DOM after page load.
  $("iframe").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (!/maps\.google\.com|google\.com\/maps/i.test(src)) return;
    const w = $(el).attr("width") || "100%";
    const h = $(el).attr("height") || "450";
    const existingStyle = $(el).attr("style") || "";
    $(el).replaceWith(
      `<div data-wg-maps-url="${src}" style="width:${/^\d+$/.test(w) ? w + "px" : w};height:${/^\d+$/.test(h) ? h + "px" : h};overflow:hidden;border-radius:8px;${existingStyle}"></div>`
    );
  });

  // ── 5c. Iframe loader — handles both booking and Google Maps ─────────────────
  // Plain iframes — Termly allows supersaas.com and google.com/maps as Essential.
  $("script").filter((_, el) => !!($(el).html()?.includes("wg-booking-container") || $(el).html()?.includes("wg-maps-url"))).remove();
  $("body").append(`<script data-wg="wg-iframe-loader">(function(){
function makeIframe(c,url,iframeStyle,iframeId){
  if(c.querySelector('iframe'))return;
  var f=document.createElement('iframe');
  f.src=url;f.setAttribute('scrolling','auto');f.setAttribute('style',iframeStyle);
  if(iframeId)f.id=iframeId;
  c.innerHTML='';c.appendChild(f);
}
// Listen for SuperSaaS postMessage resize events — adjusts iframe height to actual content.
window.addEventListener('message',function(e){
  var f=document.getElementById('wg-booking-iframe');
  if(!f||!e.data)return;
  var h=0;
  if(typeof e.data==='number'&&e.data>200)h=e.data;
  else if(typeof e.data==='object'&&e.data.height>200)h=e.data.height;
  else if(typeof e.data==='string'){var m=e.data.match(/height[=:]\\s*(\\d+)/i);if(m)h=parseInt(m[1]);}
  if(h>200){f.style.height=h+'px';var c=document.getElementById('wg-booking-container');if(c)c.style.minHeight=h+'px';}
});
function loadAll(){
  var b=document.getElementById('wg-booking-container');
  if(b){var bu=b.getAttribute('data-wg-url');if(bu)makeIframe(b,bu,'display:block;width:100%;height:900px;border:none;background:#fff;','wg-booking-iframe');}
  document.querySelectorAll('[data-wg-maps-url]').forEach(function(c){
    var mu=c.getAttribute('data-wg-maps-url');
    if(mu)makeIframe(c,mu,'display:block;width:100%;height:100%;border:none;');
  });
}
if(document.readyState==='complete'){loadAll();}
else{window.addEventListener('load',loadAll);}
})()</script>`);

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

    // Always skip external links, tel, mailto
    if (/^(https?:|mailto:|tel:)/.test(href)) return;

    const text = $el.text().trim().replace(/^[^a-z]+/i, "").replace(/[^a-z]+$/i, "").trim().toLowerCase();
    const fragment = href.startsWith("#") ? href.slice(1).toLowerCase() : "";

    // Resolve intended target from text label (label is authoritative) or fragment
    const target = navLinkMap[text] ||
      Object.entries(navLinkMap).find(([k]) => text.includes(k))?.[1] ||
      navLinkMap[fragment] ||
      Object.entries(navLinkMap).find(([k]) => fragment.includes(k))?.[1] ||
      fragment;

    if (!target) return;

    // Only wire if target section actually exists in DOM
    if (!$(`[id="${target}"], [data-page="${target}"]`).length) return;

    // Skip only if ALREADY correctly wired to the right target (not just any navigateTo)
    if (onclick.includes(`navigateTo('${target}')`) || onclick.includes(`navigateTo("${target}")`)) return;

    // Re-wire (this also fixes Stitch mis-wirings like "Contact Us" → booking)
    $el.attr("href", "#");
    $el.attr("onclick", `event.preventDefault();window.navigateTo&&window.navigateTo('${target}')`);
  });

  // ── 6b. Rewire CTA buttons ──────────────────────────────────────────────────────
  // "Get a Quote" / "Request a Quote" → click-to-call the client phone (service businesses
  //   need a quote conversation before a booking, so sending these to the booking calendar
  //   creates friction).
  // "Book Now" / "See Availability" / "Schedule" → booking section.
  // hasBookingFeature can be false even when SuperSaaS is configured (bookingUrl set but
  // hasBooking flag not persisted). Guard only on the section actually being present.
  const quoteRe = /^(?:get\s+(?:a\s+)?(?:free\s+)?quote|request\s+(?:a\s+)?quote)$/i;
  const bookRe  = /^(?:book\s+(?:now|a(?:n\s+appointment)?)?|see\s+availability|schedule\s+(?:an?\s+)?appointment|get\s+started|contact\s+us\s+today)$/i;
  const hasBookingSection = !!$("[id='booking'], [data-page='booking']").length;

  $("a, button").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const onclick = $el.attr("onclick") || "";
    // Skip external links, tel, mailto
    if (/^(https?:|mailto:|tel:)/.test(href)) return;
    // Strip leading/trailing non-letter characters (arrows →, icons, punctuation)
    const text = $el.text().trim().replace(/^[^a-z]+/i, "").replace(/[^a-z]+$/i, "").trim();

    if (quoteRe.test(text) && clientPhone) {
      // Wire quote CTAs to click-to-call
      const already = href.startsWith("tel:") || onclick.includes("tel:");
      if (already) return;
      const digits = clientPhone.replace(/\s+/g, "");
      $el.attr("href", `tel:${digits}`);
      $el.removeAttr("onclick");
    } else if (bookRe.test(text) && hasBookingSection) {
      // Wire booking CTAs to the booking section
      const alreadyBooking = onclick.includes("'booking'") || onclick.includes('"booking"');
      if (alreadyBooking) return;
      $el.attr("href", "#");
      $el.attr("onclick", `event.preventDefault();window.navigateTo&&window.navigateTo('booking')`);
    }
  });
  console.log("[DomInject] CTA buttons rewired (quote→phone, book→#booking)");

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
  // Always remove and re-inject so every Fix run gets the latest hamburger/nav code.
  // Match both "window.navigateTo=" and "window.navigateTo =" (with or without space).
  $("script").filter((_, el) => !!($(el).html()?.includes("window.navigateTo"))).remove();
  $("body").append(buildNavigateToScript(isMultiPage, jobId));

  // ── 9. Inject GA4 if provided ────────────────────────────────────────────────
  if (ga4Id && !html.includes(ga4Id)) {
    $("head").append(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>`);
    $("head").append(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`);
  }

  // ── 10. Inject JSON-LD LocalBusiness + og:image ──────────────────────────────
  // Structured data is the single biggest local SEO win for small businesses.
  // og:image ensures proper social previews when the URL is shared.
  {
    // JSON-LD LocalBusiness schema
    if (!$.html().includes('"@type":"LocalBusiness"') && !$.html().includes('"@type": "LocalBusiness"')) {
      const schemaObj: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": businessName,
      };
      if (clientEmail)        schemaObj["email"]       = clientEmail;
      if (clientPhone)        schemaObj["telephone"]   = clientPhone;
      if (businessAddress)    schemaObj["address"]     = { "@type": "PostalAddress", "streetAddress": businessAddress };
      if (logoUrl)            schemaObj["logo"]        = logoUrl;
      if (heroUrl)            schemaObj["image"]       = heroUrl;
      const sameAs = [
        socialLinks.facebookPage,
        socialLinks.instagramUrl?.startsWith("http") ? socialLinks.instagramUrl : socialLinks.instagramUrl ? `https://instagram.com/${socialLinks.instagramUrl.replace(/^@/,"")}` : undefined,
        socialLinks.linkedinUrl,
        socialLinks.tiktokUrl?.startsWith("http") ? socialLinks.tiktokUrl : socialLinks.tiktokUrl ? `https://tiktok.com/@${socialLinks.tiktokUrl.replace(/^@/,"")}` : undefined,
        socialLinks.youtubeUrl,
      ].filter(Boolean);
      if (sameAs.length) schemaObj["sameAs"] = sameAs;
      $("head").append(`<script type="application/ld+json">${JSON.stringify(schemaObj)}</script>`);
    }

    // og:image — add if hero/logo available and not already set
    if ((heroUrl || logoUrl) && !$.html().includes('property="og:image"')) {
      $("head").append(`<meta property="og:image" content="${heroUrl || logoUrl}">`);
    }

    // Favicon — replace Vercel default with logo or generated letter icon
    $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').remove();
    if (logoUrl) {
      $("head").append(`<link rel="icon" type="image/png" href="${logoUrl}">`);
      $("head").append(`<link rel="apple-touch-icon" href="${logoUrl}">`);
    } else {
      // Generate a simple SVG letter favicon from the first letter of the business name
      const letter = (businessName || "W").charAt(0).toUpperCase();
      const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#1a1a2e"/><text x="50" y="72" font-family="system-ui,sans-serif" font-size="62" font-weight="700" text-anchor="middle" fill="white">${letter}</text></svg>`;
      const encoded = Buffer.from(svgFavicon).toString("base64");
      $("head").append(`<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${encoded}">`);
    }
  }

  // ── 11. Wire social media links into Stitch's existing footer icons ──────────
  // Stitch generates social icons in the footer. We update their href in-place
  // rather than prepending a new block (which creates a floating duplicate).
  if (Object.values(socialLinks).some(v => v)) {
    const normalise = (platform: string, raw: string): string => {
      if (!raw) return "";
      if (raw.startsWith("http")) return raw;
      if (platform === "instagram") return `https://instagram.com/${raw.replace(/^@/, "")}`;
      if (platform === "tiktok")   return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
      if (platform === "youtube")  return `https://youtube.com/@${raw.replace(/^@/, "")}`;
      return `https://${raw}`;
    };
    const platformUrls: Record<string, string> = {
      facebook:  normalise("facebook",  socialLinks.facebookPage  || ""),
      instagram: normalise("instagram", socialLinks.instagramUrl  || ""),
      linkedin:  normalise("linkedin",  socialLinks.linkedinUrl   || ""),
      tiktok:    normalise("tiktok",    socialLinks.tiktokUrl     || ""),
      youtube:   normalise("youtube",   socialLinks.youtubeUrl    || ""),
    };

    $("footer a, [class*='footer'] a, [id='footer'] a").each((_, el) => {
      const $el = $(el);
      const href  = ($el.attr("href") || "").toLowerCase();
      const aria  = ($el.attr("aria-label") || "").toLowerCase();
      const title = ($el.attr("title") || "").toLowerCase();
      const text  = $el.text().trim().toLowerCase();
      const svgHtml = $el.find("svg").html() || "";

      let platform = "";
      if (href.includes("facebook") || aria.includes("facebook") || title.includes("facebook") || text === "f")
        platform = "facebook";
      else if (href.includes("instagram") || aria.includes("instagram") || title.includes("instagram"))
        platform = "instagram";
      else if (href.includes("linkedin") || aria.includes("linkedin") || title.includes("linkedin"))
        platform = "linkedin";
      else if (href.includes("tiktok") || aria.includes("tiktok") || title.includes("tiktok"))
        platform = "tiktok";
      else if (href.includes("youtube") || aria.includes("youtube") || title.includes("youtube"))
        platform = "youtube";

      if (!platform || !platformUrls[platform]) return;
      $el.attr("href", platformUrls[platform])
         .attr("target", "_blank")
         .attr("rel", "noopener noreferrer");
    });
  }

  // ── 13. Inject Tawk.to if provided ──────────────────────────────────────────
  if (tawktoPropertyId && !html.includes("tawk.to")) {
    $("body").append(`<script type="text/javascript">var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${tawktoPropertyId}/default';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();</script>`);
  }

  // ── 14. Inject WG_JOB global ─────────────────────────────────────────────────
  // WG_JOB is already set inside the navigateTo script; only add a separate tag
  // if the navigateTo script was skipped (jobId missing) or as belt-and-suspenders.
  // Do NOT remove() here — the filter would match the navigateTo script and delete it.
  if (jobId && !$.html().includes("WG_JOB")) {
    $("head").append(`<script>window.WG_JOB="${jobId}";</script>`);
  }

  // ── 15a. Inject ABN into footer ───────────────────────────────────────────────
  if (abn) {
    const abnText = `ABN ${abn}`;
    const $footer = $("footer, [id='footer'], [class*='footer']").first();
    if ($footer.length) {
      // Replace existing ABN placeholder if present, otherwise append
      const footerHtml = $footer.html() || "";
      if (/ABN\s*:?\s*[\d\s]{9,14}/i.test(footerHtml)) {
        $footer.html(footerHtml.replace(/ABN\s*:?\s*[\d\s]{9,14}/gi, abnText));
      } else {
        $footer.append(`<p style="font-size:0.75rem;opacity:0.6;margin-top:8px;text-align:center;">${abnText}</p>`);
      }
    }
  }

  // ── 15b. Mobile fix CSS — email overflow ─────────────────────────────────────
  // Always remove and re-inject so Fix runs pick up any CSS changes.
  $("[data-wg='wg-mobile-fixes']").remove();
  $("head").append(`<style data-wg="wg-mobile-fixes">a[href^="mailto:"],a[href^="tel:"]{word-break:break-all;overflow-wrap:break-word;}footer a,footer p,footer span,footer li,#footer a,#footer p,#footer span,[class*="footer"] a,[class*="footer"] p,[class*="footer"] span,[class*="footer"] li{color:#fff!important;}</style>`);

  // ── 15. Wire Privacy/Terms footer links ──────────────────────────────────────
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

  // Remove duplicate legalFooter divs injected by auditor.ts if nav already has wired policy links.
  // auditor.ts injects a small centered div (font-size:12px) before the build wires the nav links —
  // on re-Fix runs the nav links are already wired, making the small div redundant.
  $("footer, [id='footer'], [class*='footer']").find("div").each((_, el) => {
    const $div = $(el);
    const style = $div.attr("style") || "";
    if (!style.includes("font-size:12px")) return;
    const links = $div.find("a");
    const allPolicyLinks = links.toArray().every(a =>
      /privacy|terms|cookie/i.test($(a).text())
    );
    if (links.length >= 2 && allPolicyLinks) $div.remove();
  });

  // ── 16a. WCAG 2.1 AA — every img must have an alt attribute ─────────────────────
  $("img").each((_, el) => {
    if ($(el).attr("alt") === undefined) {
      $(el).attr("alt", "");
    }
  });

  // ── 16b. Policy overlay pages (Privacy, Terms, Cookie Policy) ────────────────
  // Must run BEFORE $.html() so overlays make it into the serialised string.
  function extractPolicyContent(raw: string): string {
    if (!/<html[\s>]/i.test(raw)) return raw;
    const $doc = cheerio.load(raw, { xmlMode: false });
    const headStyles = $doc("head style, head link[rel='stylesheet']").map((_, el) => $doc.html(el)).get().join("\n");
    const bodyContent = $doc("body").html() || "";
    return headStyles + bodyContent;
  }
  const policyOverlay = (id: string, rawContent: string) => {
    const content = extractPolicyContent(rawContent);
    return (
      `<div id="${id}" style="display:none;position:fixed;inset:0;background:#fff;overflow-y:auto;z-index:99999;">` +
      `<div style="max-width:900px;margin:0 auto;padding:32px 24px 100px;">` +
      `<button onclick="document.getElementById('${id}').style.display='none'" ` +
      `style="position:sticky;top:16px;float:right;background:#f1f5f9;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;z-index:1;">✕ Close</button>` +
      content +
      `</div></div>`
    );
  };
  if (privacyPageHtml) {
    $("[id='privacy']").remove();
    $("body").append(policyOverlay("privacy", privacyPageHtml));
  }
  if (termsPageHtml) {
    $("[id='terms']").remove();
    $("body").append(policyOverlay("terms", termsPageHtml));
  }
  if (cookiePageHtml) {
    $("[id='cookies']").remove();
    $("body").append(policyOverlay("cookies", cookiePageHtml));
    // Wire existing cookie links
    $("footer a, [id='footer'] a, [class*='footer'] a").each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (/cookie/i.test(text) && !$(el).attr("onclick")?.includes("navigateTo")) {
        $(el).attr("onclick", "event.preventDefault();window.navigateTo&&window.navigateTo('cookies')");
        $(el).attr("href", "#");
      }
    });
    // Inject Cookie Policy link after Terms of Service link if not already present
    const hasCookieFooterLink =
      $("footer, [id='footer'], [class*='footer']").html()?.includes("navigateTo('cookies')") ||
      $("footer, [id='footer'], [class*='footer']").html()?.includes('navigateTo("cookies")');
    if (!hasCookieFooterLink) {
      // Find the Terms link to insert after, else append into footer
      const $termsLink = $("footer a[onclick*=\"navigateTo('terms')\"], footer a[onclick*='navigateTo(\"terms\")'], [id='footer'] a[onclick*=\"navigateTo('terms')\"], [class*='footer'] a[onclick*=\"navigateTo('terms')\"]").first();
      const cookieLinkHtml = `<span style="color:inherit;"> | </span><a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('cookies')" style="color:inherit;text-decoration:none;margin:0 10px;">Cookie Policy</a>`;
      if ($termsLink.length) {
        $termsLink.after(cookieLinkHtml);
      } else {
        // Fallback: append to last footer element
        $("footer, [id='footer'], [class*='footer']").last().append(
          `<div style="text-align:center;padding:4px 0;font-size:12px;"><a href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('cookies')" style="color:inherit;text-decoration:none;">Cookie Policy</a></div>`
        );
      }
    }
  }

  // ── 16. Replace aida-public URLs in CSS background-image (inline styles) ───────
  // Stitch often uses `style="background-image: url('aida...')"` for hero/section
  // backgrounds. Cheerio <img> replacement above misses these entirely.
  let out = $.html();
  if (heroUrl || photoUrls.length > 0) {
    let bgHeroUsed = false;
    out = out.replace(
      /background-image:\s*url\(['"]?(https:\/\/lh3\.googleusercontent\.com\/aida[^'")\s]*?)['"]?\)/gi,
      () => {
        // First background → hero image
        if (heroUrl && !bgHeroUsed) { bgHeroUsed = true; return `background-image: url('${heroUrl}')`; }
        // Subsequent backgrounds → pick from unused photos (shared set with img replacement)
        for (let i = 0; i < contentPhotos.length; i++) {
          if (!usedPhotoIndices.has(i)) {
            usedPhotoIndices.add(i);
            return `background-image: url('${contentPhotos[i]}')`;
          }
        }
        // All photos exhausted — keep Stitch placeholder intact (no fallback to last photo)
        return `background-image: url('${heroUrl || ""}')`;
      }
    );
  }
  // ── 17. Add kiosk=1 to any residual static SuperSaas iframes ────────────────
  // (dynamic-injection approach above already includes kiosk=1; this catches any leftovers)
  out = out.replace(
    /(<iframe[^>]*src=["'])(https:\/\/www\.supersaas\.com\/schedule\/[^'"?]+)(['"][^>]*>)/gi,
    (_m, pre, url, post) => `${pre}${url}?kiosk=1${post}`
  );

  // ── 18. Inject custom head / body / footer code ──────────────────────────────
  // Strip previous marker-wrapped injections first (prevents duplicates on re-Fix).
  out = out.replace(/<!-- wg-custom-head-start -->[\s\S]*?<!-- wg-custom-head-end -->\n?/g, "");
  out = out.replace(/<!-- wg-custom-body-start -->[\s\S]*?<!-- wg-custom-body-end -->\n?/g, "");
  out = out.replace(/<!-- wg-custom-footer-start -->[\s\S]*?<!-- wg-custom-footer-end -->\n?/g, "");
  if (customHeadHtml) {
    out = out.replace(/(<\/head>)/i, `<!-- wg-custom-head-start -->\n${customHeadHtml}\n<!-- wg-custom-head-end -->\n$1`);
  }
  if (customBodyHtml) {
    out = out.replace(/(<\/body>)/i, `<!-- wg-custom-body-start -->\n${customBodyHtml}\n<!-- wg-custom-body-end -->\n$1`);
  }
  if (customFooterHtml) {
    out = out.replace(/(<\/footer>)/i, `<!-- wg-custom-footer-start -->\n${customFooterHtml}\n<!-- wg-custom-footer-end -->\n$1`);
  }

  // Deduplicate <script src="..."> tags — catches legacy duplicates from pre-marker Fix runs.
  {
    const seenSrcs = new Set<string>();
    out = out.replace(/<script([^>]+src=["'])([^"']+)(["'][^>]*)>([\s\S]*?)<\/script>/gi,
      (match, pre, src, post) => {
        if (seenSrcs.has(src)) return "";
        seenSrcs.add(src);
        return match;
      });
  }

  // ── 18b. Auto-CSS for cookie consent banners ──────────────────────────────────
  const hasCookieBanner = /termly\.io|cookieyes\.com|cookiebot\.com|osano\.com|onetrust\.com|iubenda\.com/i.test(customHeadHtml + customBodyHtml);
  if (hasCookieBanner) {
    // Remove ALL previous wg-cookie-banner-fix tags (old ones had padding-bottom which caused footer gap).
    out = out.replace(/<style[^>]*data-wg="wg-cookie-banner-fix"[^>]*>[\s\S]*?<\/style>/gi, "");
    const bannerCss = `<style data-wg="wg-cookie-banner-fix">:root{--wg-accent:${accentColor};}` +
      `#termly-consent-preferences,.termly-display-preferences,[id*="termly"][class*="preference"],[data-termly="display-preferences"],.termly-code-snippet-support{display:none!important;}</style>`;
    out = out.replace(/(<\/head>)/i, `${bannerCss}\n$1`);

    // Add "Consent Preferences" link inline in the footer nav alongside Privacy/Terms/Cookie.
    // Only inject once — skip if already present.
    if (!out.includes("displayPreferenceModal")) {
      const consentLink = ` | <a href="#" onclick="event.preventDefault();window.displayPreferenceModal&&window.displayPreferenceModal()" style="color:#fff;text-decoration:none;margin:0 10px;">Consent Preferences</a>`;
      // Prefer inserting after Cookie Policy link; fall back to after Terms link
      if (/navigateTo\('cookies'\)[^>]*>Cookie Policy<\/a>/.test(out)) {
        out = out.replace(
          /(navigateTo\('cookies'\)[^>]*>Cookie Policy<\/a>)/,
          `$1${consentLink}`
        );
      } else if (/navigateTo\('terms'\)[^>]*>[^<]*Terms[^<]*<\/a>/.test(out)) {
        out = out.replace(
          /(navigateTo\('terms'\)[^>]*>[^<]*Terms[^<]*<\/a>)/,
          `$1${consentLink}`
        );
      }
    }
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
  if(drawer){drawer.style.display="";drawer.classList.add("hidden");}

  // Single-page: legal pages are overlay modals
  if(!window.WG_IS_MULTIPAGE&&(pageId==="privacy"||pageId==="terms"||pageId==="cookies")){
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

// Multi-page init: inject hide/show CSS and activate first page
if(window.WG_IS_MULTIPAGE){
  if(!document.querySelector("style[data-wg-mp]")){
    var mp=document.createElement("style");
    mp.setAttribute("data-wg-mp","1");
    mp.textContent="[data-page]{display:none!important;opacity:0;}[data-page].active{display:block!important;opacity:1;}";
    document.head.appendChild(mp);
  }
  var pages=document.querySelectorAll("[data-page]");
  if(pages.length>0){
    var active=document.querySelector("[data-page].active")||pages[0];
    pages.forEach(function(p){p.classList.remove("active");});
    active.classList.add("active");
  }
}

// Wire hamburger — only for buttons with no onclick (Stitch buttons already have their own)
(function(){
  document.querySelectorAll("#hamburger,#menu-toggle,#mobile-menu-btn").forEach(function(btn){
    if(btn.getAttribute("onclick"))return; // Stitch already wired it — don't interfere
    btn.addEventListener("click",function(){
      var d=document.getElementById("mobile-menu")||document.getElementById("side-drawer")||document.getElementById("mobile-nav");
      if(!d)return;
      d.classList.toggle("hidden");
    });
  });
})();

// Delegated booking-CTA handler — capture phase fires before any element-level handler,
// including Stitch's mobile menu listeners and dynamically-created elements.
// Handles ALL matching clicks unconditionally so a broken/missing onclick can't interfere.
(function(){
  var ctaRe=/^(?:book\s+now|book\s+an?\s+appointment|see\s+availability|schedule\s+(?:an?\s+)?appointment|get\s+started)$/i;
  document.addEventListener('click',function(e){
    if(!(document.getElementById('booking')||document.querySelector('[data-page="booking"]')))return;
    var el=e.target;
    while(el&&el!==document.body){if(el.tagName==='A'||el.tagName==='BUTTON')break;el=el.parentElement;}
    if(!el||el===document.body)return;
    var text=(el.textContent||'').trim().replace(/^[^\w]+/,'').replace(/[^\w]+$/,'').trim();
    if(!ctaRe.test(text))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.navigateTo&&window.navigateTo('booking');
    // After any page-transition or menu-close animation, scroll directly to the
    // booking container (iframe wrapper) — not just the section heading.
    setTimeout(function(){
      var bc=document.getElementById('wg-booking-container')||document.getElementById('booking');
      if(bc){bc.scrollIntoView({behavior:'smooth',block:'start'});}
    },320);
  },true);
})();
})();
</script>`;
}
