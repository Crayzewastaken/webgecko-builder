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
}

export function domInject(params: DomInjectParams): string {
  const {
    html, businessName, clientEmail, clientPhone, businessAddress,
    logoUrl, heroUrl, photoUrls = [], bookingUrl, hasBookingFeature,
    isMultiPage, jobId, ga4Id, tawktoPropertyId, requestedPageIds = [],
    accentColor = "#10b981", socialLinks = {},
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
            $parent.html(`<img src="${photoUrl}" alt="Gallery ${gallerySlot}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s;" loading="lazy">`);
          } else {
            $el.replaceWith(`<img src="${photoUrl}" alt="Gallery ${gallerySlot}" style="width:100%;height:auto;display:block;" loading="lazy">`);
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
          $el.html(`<img src="${photoUrl}" alt="Gallery ${gallerySlot}" class="w-full h-full object-cover" loading="lazy">`);
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
            $el.html(`<img src="${photoUrl}" alt="Gallery ${gallerySlot}" class="w-full h-full object-cover" loading="lazy">`);
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

    // Always skip external links, tel, mailto
    if (/^(https?:|mailto:|tel:)/.test(href)) return;

    const text = $el.text().trim().toLowerCase();
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
  if (jobId && !html.includes("WG_JOB")) {
    $("head").append(`<script>window.WG_JOB="${jobId}";</script>`);
  }

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
