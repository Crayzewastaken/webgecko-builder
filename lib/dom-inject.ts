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

  // ── 3. Inject logo into nav ───────────────────────────────────────────────────
  if (logoUrl) {
    const navImg = $("header img, nav img").first();
    if (navImg.length) {
      const currentSrc = navImg.attr("src") || "";
      const isStitchGenerated = isStitchImage(currentSrc);
      // Replace if it's a Stitch-generated image, blank, or placeholder
      if (isStitchGenerated || currentSrc === "" || currentSrc.startsWith("#") || currentSrc.includes("placeholder")) {
        navImg.attr("src", logoUrl);
        navImg.attr("alt", businessName);
        navImg.attr("style", "height:40px;width:auto;object-fit:contain;");
      }
    } else {
      // No img in nav at all — insert one before the business name text
      const navText = $("header [class*='logo'], header [class*='brand'], header [class*='site-name'], nav [class*='logo'], nav [class*='brand']").first();
      if (navText.length) {
        navText.prepend(`<img src="${logoUrl}" alt="${businessName}" style="height:40px;width:auto;object-fit:contain;margin-right:8px;vertical-align:middle;">`);
      } else {
        // Last resort — prepend to start of header
        $("header, nav").first().prepend(`<img src="${logoUrl}" alt="${businessName}" style="height:40px;width:auto;object-fit:contain;">`);
      }
    }
  }

  // ── 4. Replace Stitch placeholder images with client photos ──────────────────
  // Stitch generates images from lh3.googleusercontent.com/aida/ (new) or /aida-public/ (old)
  if (heroUrl || photoUrls.length > 0) {
    const allPhotos = [...(heroUrl ? [heroUrl] : []), ...photoUrls];
    let photoIdx = 0;

    $("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (!isStitchImage(src)) return;

      // Skip logo slot in header/nav
      const inNav = $(el).closest("header, nav").length > 0;
      if (inNav) return;

      // Use heroUrl for the first hero section image
      const inHero = $(el).closest("#home, #hero, [id*='hero'], [class*='hero'], section:first-of-type").length > 0;
      if (inHero && heroUrl && photoIdx === 0) {
        $(el).attr("src", heroUrl);
        $(el).attr("loading", "lazy");
        photoIdx++;
        return;
      }

      if (allPhotos.length > 0) {
        $(el).attr("src", allPhotos[photoIdx % allPhotos.length]);
        $(el).attr("loading", "lazy");
        photoIdx++;
      }
    });
    console.log(`[DomInject] Replaced Stitch placeholder images. Photos cycled: ${photoIdx}`);
  }

  // ── 5. Inject booking iframe ──────────────────────────────────────────────────
  if (hasBookingFeature && bookingUrl) {
    const bookingSection = $("[id='booking']").first();
    const iframeHtml = `<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" scrolling="auto" style="display:block;background:#fff;border-radius:8px;border:none;" title="Book an Appointment" loading="lazy"></iframe>`;

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

      // Find Stitch's placeholder container — look for divs containing placeholder text
      // Stitch uses patterns like "[ Booking Iframe Placeholder ]" or calendar icons
      let injected = false;

      // Strategy 1: find a div with placeholder text and replace its entire contents
      bookingSection.find("div").each((_, el) => {
        if (injected) return;
        const text = $(el).text().trim();
        const hasPlaceholderText = /booking.*iframe.*placeholder|iframe.*placeholder|booking system loads|calendar_month/i.test(text) ||
          /\[\s*booking/i.test(text);
        if (hasPlaceholderText) {
          $(el).html(iframeHtml);
          $(el).attr("style", "width:100%;border-radius:8px;overflow:hidden;");
          injected = true;
        }
      });

      // Strategy 2: find named placeholder containers
      if (!injected) {
        const namedPlaceholder = bookingSection.find(
          "#booking-iframe-container, [id*='booking-iframe'], [class*='booking-placeholder'], [class*='iframe-placeholder']"
        ).first();
        if (namedPlaceholder.length) {
          namedPlaceholder.html(iframeHtml);
          namedPlaceholder.attr("style", "width:100%;");
          injected = true;
        }
      }

      // Strategy 3: find the largest div (most likely the content wrapper) and replace
      if (!injected) {
        // Get the direct child divs of the booking section's content container
        const contentDiv = bookingSection.find("> div, > div > div").first();
        if (contentDiv.length) {
          contentDiv.append(iframeHtml);
          injected = true;
        } else {
          bookingSection.append(iframeHtml);
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

  return $.html();
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
