// lib/pipeline-step5.ts
// Step 5 — Code-only fix pass.
// Extracted from app/api/inngest/route.ts to reduce monolith size.
// Contains all regex/string-based post-processing: CTA wiring, placeholder
// replacement, maps, video, social links, newsletter, popup, testimonials,
// script stripping, markdown cleaning, and SEO meta injection.

import { resolveStitchClasses, normalizePageId } from "./pipeline-helpers";

export interface Step5Params {
  html:                    string;
  userInput:               Record<string, any>;
  features:                string[];
  clientEmail:             string;
  clientPhone:             string;
  businessAddress:         string;
  rawDomain:               string;
  ctaExternalUrl:          string;
  bookingUrl:              string;
  hasBookingFeature:       boolean;
  requestedPageIds:        string[];
  spec:                    { projectTitle?: string; lsiKeywords?: string[]; palette?: any };
  savedHtmlForRebuild:     boolean;
  isUsingRawStitchForRebuild: boolean;
}

export function applyStep5CodeFixes(params: Step5Params): string {
  const {
    userInput, features, clientEmail, clientPhone, businessAddress,
    rawDomain, ctaExternalUrl, bookingUrl, hasBookingFeature,
    requestedPageIds, spec, savedHtmlForRebuild, isUsingRawStitchForRebuild,
  } = params;

  let html = resolveStitchClasses(params.html);
  const bookingNavTarget = hasBookingFeature ? "booking" : "contact";

  // ── Title ─────────────────────────────────────────────────────────────────
  if (userInput.businessName) {
    html = html.replace(/<title>([^<]*)<\/title>/i, (_m: string, existing: string) => {
      const trimmed = existing.trim();
      if (trimmed.includes('|') || trimmed.includes(' - ') || trimmed.length > userInput.businessName.length + 5) {
        return `<title>${trimmed}</title>`;
      }
      return `<title>${userInput.businessName}</title>`;
    });
  }

  // ── Email / phone / address replacement ──────────────────────────────────
  const clientDomain    = clientEmail.split("@")[1] || "";
  const businessSlugFix = (userInput.businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  html = html.replace(/\b[\w.+-]+@(example|company|business|yourcompany|yourbusiness|domain|email|test|sample|placeholder|site|gym|studio|salon|clinic|law|dental|realty|auto|cafe|restaurant|johnsgymsydney|johnsrestaurant|acmeconstruction|smithplumbing|greenthumb|brightsmile|eliteperformance|performancegym|purestrength|ironcore|elitefit|fitnesspro|peakperformance|urbanfit|alphaperformance)\.(com|com\.au|au|net|org)\b/gi, clientEmail);
  if (clientDomain && businessSlugFix) {
    html = html.replace(/\b(info|hello|contact|admin|support|enquiries|enquiry|mail|office|reception|noreply|no-reply)@([\w-]+)\.(com|com\.au|au|net|org)\b/gi, (m: string, _prefix: string, domain: string) => {
      if (m === clientEmail) return m;
      if (m.includes("webgecko")) return m;
      if (clientDomain && m.toLowerCase().endsWith(clientDomain.toLowerCase())) return m;
      const domainStripped = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (domainStripped.includes(businessSlugFix.slice(0, 6)) || businessSlugFix.includes(domainStripped.slice(0, 6))) return clientEmail;
      return m;
    });
  }
  const clientPhoneDigits = clientPhone.replace(/\D/g, "");
  html = html.replace(/\b(0[0-9]{3}\s?[0-9]{3}\s?[0-9]{3,4})\b/g, (m: string) => {
    const digits = m.replace(/\D/g, "");
    if (digits === clientPhoneDigits) return m;
    if (/0{4,}/.test(digits) || /(\d)\1{4,}/.test(digits)) return clientPhone;
    return m;
  });
  html = html.replace(/\(\d{2}\)\s?\d{4}\s?\d{4}/g, clientPhone);
  html = html.replace(/\+61\s?[2-9]\s?\d{4}\s?\d{4}/g, clientPhone);
  if (businessAddress) {
    html = html.replace(/\b123\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Place|Pl|Court|Ct)[,\s]+(?:Sydney|Melbourne|Brisbane|Perth|Adelaide|Gold Coast|Canberra|Darwin|Hobart)[,\s]+(?:NSW|VIC|QLD|WA|SA|ACT|NT|TAS)\s+\d{4}\b/gi, businessAddress);
    html = html.replace(/MAP PLACEHOLDER[:\s]*[A-Z\s]+/gi, businessAddress);
  }

  // ── Three-tier CTA keyword system ─────────────────────────────────────────
  const bookingCtaKeywords = ['book now','book a session','book a call','book a consult','book consultation','book free','book today','book online','join now','sign up','free trial','try free','reserve','schedule now','schedule a call','claim offer','claim now','apply now','start today','start free','start starter','start business','start premium','start plan','start now'];
  const contactCtaKeywords = ['get in touch','contact us','reach out'];
  const shopCtaKeywords    = ['shop the setup','shop now','shop','buy the kit','buy kit','buy setup','buy system','buy now','buy pro','buy elite','buy starter','buy the','add to cart','view products','browse products','view shop','shop products','get the kit','grab the kit','order kit','get pro','get elite','get starter','get the system','get the setup','order now'];
  const demoCtaKeywords    = ['watch demo','watch the demo','see it in action','view demo','demo','see demo','try demo','watch it','watch now'];
  const generalCtaKeywords = ['get started','get a quote','get free quote','get quote','enquire now','enquire','learn more','find out more','discover more','request a quote','request quote','explore capability','explore','launch','login','log in','sign in'];
  const allCtaKeywords     = [...bookingCtaKeywords, ...contactCtaKeywords, ...shopCtaKeywords, ...demoCtaKeywords, ...generalCtaKeywords];

  const effectiveExternalCta  = ctaExternalUrl || (bookingUrl && !hasBookingFeature ? bookingUrl : "");
  const ctaExternalDomain     = effectiveExternalCta ? effectiveExternalCta.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0].toLowerCase() : "";
  const hasShopPage            = features.includes("Payments / Shop") || (userInput.pages || []).some((p: string) => normalizePageId(p) === "shop");

  const bookingCtaOnclick = effectiveExternalCta
    ? `window.open('${effectiveExternalCta}','_blank')`
    : `event.preventDefault();window.navigateTo&&window.navigateTo('${hasBookingFeature ? "booking" : "contact"}')`;
  const contactCtaOnclick = `event.preventDefault();window.navigateTo&&window.navigateTo('contact')`;
  const shopCtaOnclick    = `event.preventDefault();window.navigateTo&&window.navigateTo('${hasShopPage ? "shop" : "contact"}')`;
  const demoCtaOnclick    = effectiveExternalCta
    ? `window.open('${effectiveExternalCta}','_blank')`
    : `event.preventDefault();window.navigateTo&&window.navigateTo('${hasShopPage ? "shop" : "contact"}')`;
  const generalCtaOnclick = effectiveExternalCta
    ? `window.open('${effectiveExternalCta}','_blank')`
    : hasShopPage
      ? `event.preventDefault();window.navigateTo&&window.navigateTo('shop')`
      : `event.preventDefault();window.navigateTo&&window.navigateTo('${bookingNavTarget}')`;

  const getCtaOnclick = (txt: string): string => {
    if (shopCtaKeywords.some((k: string)    => txt.includes(k))) return shopCtaOnclick;
    if (demoCtaKeywords.some((k: string)    => txt.includes(k))) return demoCtaOnclick;
    if (bookingCtaKeywords.some((k: string) => txt.includes(k))) return bookingCtaOnclick;
    if (contactCtaKeywords.some((k: string) => txt.includes(k))) return contactCtaOnclick;
    return generalCtaOnclick;
  };

  // Hard sweep: replace vercel/webgecko domain links
  html = html.replace(/<a([^>]*)href=["'](https?:\/\/(?:[\w-]+\.)?(?:webgecko-builder|vercel)\.(?:app|com|io)[^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi, (_m: string, pre: string, href: string, post: string, inner: string) => {
    const hrefDomain = href.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0].toLowerCase();
    if (ctaExternalDomain && hrefDomain === ctaExternalDomain) return _m;
    const txt = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
    const onclick = getCtaOnclick(txt);
    const cleanPre = pre.replace(/\s*onclick=["'][^"']*["']/gi, "");
    const cleanPost = post.replace(/\s*onclick=["'][^"']*["']/gi, "");
    return `<a${cleanPre}${cleanPost} href="#" onclick="${onclick}">${inner}</a>`;
  });

  // Wire <a> CTA links
  html = html.replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
    const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (!allCtaKeywords.some((k: string) => txt.includes(k))) return match;
    if (attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
    if (attrs.includes('type="submit"')) return match;
    if (/href=["'](?:mailto:|tel:)/i.test(attrs)) return match;
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    if (href.startsWith('#') && href.length > 1) {
      const sectionId = href.slice(1);
      if (html.includes(`id="${sectionId}"`) || html.includes(`id='${sectionId}'`)) return match;
    }
    if (rawDomain && href.startsWith('http')) {
      const hrefDomain = href.replace(/^https?:\/\/(?:www\.)?/, '').split('/')[0].toLowerCase();
      if (hrefDomain === rawDomain || hrefDomain.endsWith('.' + rawDomain)) return match;
    }
    const cleanAttrs = attrs.replace(/\s*onclick=["'][^"']*(?:alert|return false|void\(0\))[^"']*["']/gi, '');
    const attrsNoHref = cleanAttrs.replace(/\s*href=["'][^"']*["']/gi, '');
    const onclick = getCtaOnclick(txt);
    return `<a${attrsNoHref} href="#" onclick="${onclick}">${inner}</a>`;
  });

  // Wire <button> CTA tags
  html = html.replace(/<button([^>]*)>([\s\S]*?)<\/button>/gi, (match: string, attrs: string, inner: string) => {
    const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (!allCtaKeywords.some((k: string) => txt.includes(k))) return match;
    if (attrs.includes('type="submit"') || attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
    const cleanAttrs = attrs.replace(/\s*onclick=["'][^"']*(?:alert|return false|void\(0\))[^"']*["']/gi, '');
    const onclick = getCtaOnclick(txt);
    return `<button${cleanAttrs} onclick="${onclick}">${inner}</button>`;
  });

  // ── Contact form cleanup ──────────────────────────────────────────────────
  html = html.replace(/<(?:div|p|label|tr)[^>]*>[^<]*(?:Business Name|Company Name|Organisation|Organization|Project (?:Goals?|Type|Details?|Description)|Subject|Username|Password|Confirm Password|Account Type|Service Type|Service Interest|How did you hear)[^<]*<\/(?:div|p|label|tr)>\s*/gi, '');
  html = html.replace(/<(?:input|select|textarea)[^>]*(?:name=["'](?:business|company|organisation|organization|subject|username|password|confirm|project_type|service_type|how_hear)[^"']*["']|placeholder=["'][^"']*(?:Business Name|Company|Organization|Project Type|Service Type|Password|Username)[^"']*["'])[^>]*>(?:<\/(?:input|select|textarea)>)?/gi, '');
  html = html.replace(/(?:Initialize Transmission|Send Brief|Submit Request|Submit Inquiry|Launch Project|Start Project|Begin Project)/gi, 'Send Message');
  html = html.replace(/(?:Start Your Project|Launch Your Project|Begin Your Project|Project Inquiry|Project Brief|Start a Project)/gi, 'Get in Touch');

  // ── Nav link wiring ───────────────────────────────────────────────────────
  const navLinkMap: Record<string, string> = {
    "home":"home","about":"about","about us":"about","services":"services","our services":"services",
    "what we do":"services","gallery":"gallery","portfolio":"gallery","our work":"gallery",
    "contact":"contact","contact us":"contact","get in touch":"contact","faq":"faq","faqs":"faq",
    "pricing":"pricing","packages":"pricing","shop":"shop","blog":"blog","team":"team",
    "booking":"booking","testimonials":"testimonials","reviews":"testimonials",
    "view portfolio":"gallery","view all work":"gallery","our projects":"gallery",
  };
  html = html.replace(/<a([^>]*href=["']#["'][^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
    if (attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
    const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
    const target = navLinkMap[txt] || Object.entries(navLinkMap).find(([k]) => txt.includes(k))?.[1];
    if (!target) return match;
    if (!html.includes(`id="${target}"`) && !html.includes(`data-page="${target}"`)) return match;
    return `<a${attrs} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${target}')">${inner}</a>`;
  });

  // ── Maps injection ────────────────────────────────────────────────────────
  if (businessAddress) {
    const mapsEmbed = process.env.GOOGLE_MAPS_API_KEY
      ? `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;display:block;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe></div>`
      : `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;"><iframe width="100%" height="350" style="border:0;display:block;" loading="lazy" allowfullscreen src="https://www.openstreetmap.org/export/embed.html?bbox=&layer=mapnik&marker=&query=${encodeURIComponent(businessAddress)}" title="Map"></iframe><small style="display:block;text-align:right;font-size:10px;color:#94a3b8;margin-top:4px;"><a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(businessAddress)}" target="_blank" style="color:#94a3b8;">View larger map</a></small></div>`;
    const hasRealMap = /<iframe[^>]*(?:google\.com\/maps|maps\.googleapis)[^>]*>/i.test(html);
    if (hasRealMap) {
      console.log("[Step5] Stitch already has Google Maps — skipping map injection");
    } else {
      html = html.replace(/<div[^>]*>\s*<iframe[^>]*(?:openstreetmap)[^>]*>[\s\S]*?<\/iframe>\s*<\/div>/gi, '');
      html = html.replace(/<iframe[^>]*(?:openstreetmap)[^>]*>[\s\S]*?<\/iframe>/gi, '');
      html = html.replace(/<a[^>]*href=["'][^"']*(?:google\.com\/maps|maps\.googleapis\.com)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
      html = html.replace(/<div[^>]*class="[^"]*(?:map|location|directions)[^"]*"[^>]*>[\s\S]{0,1500}?<\/div>/gi, (m: string) => {
        if (m.includes('<iframe')) return m;
        const textOnly = m.replace(/<[^>]+>/g, '').trim();
        if (/Map View|map-placeholder|map_icon/i.test(m)) return '';
        if (textOnly.length < 80 && /map|location|directions/i.test(m)) return '';
        return m;
      });
      html = html.replace(/<[a-z][^>]*>\s*Map View\s*:[^<]{0,100}<\/[a-z]+>/gi, '');
      html = html.replace(/<div[^>]*data-location=[^>]*>[\s\S]{0,2000}?<\/div>/gi, (m: string) => {
        if (m.includes('<iframe')) return m;
        if (/Map Loading|map-placeholder|lh3\.googleusercontent/i.test(m)) return '';
        return m;
      });
      const mapBlock = `<div id="map-section" style="width:100%;padding:0 0 60px;background:inherit;">${mapsEmbed}</div>`;
      let mapInjected = false;
      const beforeMapLen = html.length;
      html = html.replace(/<div[^>]*>\s*MAP PLACEHOLDER[^<]*<\/div>/gi, mapBlock);
      if (html.length !== beforeMapLen) mapInjected = true;
      if (!mapInjected) {
        html = html.replace(/<div([^>]*(?:id|class)="[^"]*(?:^map$|^map-|location-map|directions|gmap)[^"]*"[^>]*)>([\s\S]*?)<\/div>/gi, (match: string, _attrs: string) => {
          if (match.includes('iframe')) return match;
          mapInjected = true;
          return mapBlock;
        });
      }
      if (!mapInjected) {
        const contactOpenRe = /<(section|div)[^>]*id=["']contact["'][^>]*>/i;
        const contactOpenM = contactOpenRe.exec(html);
        if (contactOpenM) {
          const tagName = contactOpenM[1].toLowerCase();
          let depth = 1, pos = contactOpenM.index + contactOpenM[0].length, endIdx = -1;
          const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi');
          const closeRe = new RegExp(`<\\/${tagName}>`, 'gi');
          while (depth > 0 && pos < html.length) {
            openRe.lastIndex = pos; closeRe.lastIndex = pos;
            const nextOpen = openRe.exec(html), nextClose = closeRe.exec(html);
            if (!nextClose) break;
            if (nextOpen && nextOpen.index < nextClose.index) { depth++; pos = nextOpen.index + nextOpen[0].length; }
            else { depth--; pos = nextClose.index + nextClose[0].length; if (depth === 0) endIdx = pos; }
          }
          if (endIdx > 0) { html = html.slice(0, endIdx) + "\n" + mapBlock + html.slice(endIdx); mapInjected = true; }
        }
      }
      if (!mapInjected) {
        html = html.includes("<footer") ? html.replace(/<footer/i, mapBlock + "\n<footer") : html.replace("</body>", mapBlock + "\n</body>");
      }
    }
  }

  // ── Video background ──────────────────────────────────────────────────────
  if (features.includes("Video Background")) {
    const rawVideoUrl = (userInput.videoUrl || "").trim();
    let embedVideoUrl = rawVideoUrl;
    const ytMatch = rawVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) embedVideoUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&muted=1&loop=1&playlist=${ytMatch[1]}&controls=0&showinfo=0&rel=0`;
    const stockVideoMap: Record<string, string> = {
      "food":"https://coverr.co/videos/chef-cooking/mp4","hospitality":"https://coverr.co/videos/restaurant-table/mp4",
      "health":"https://coverr.co/videos/gym-workout/mp4","fitness":"https://coverr.co/videos/gym-workout/mp4",
      "beauty":"https://coverr.co/videos/spa-relax/mp4","construction":"https://coverr.co/videos/construction-site/mp4",
      "real estate":"https://coverr.co/videos/modern-house/mp4","technology":"https://coverr.co/videos/coding/mp4",
    };
    const industryLower = (userInput.industry || "").toLowerCase();
    const stockUrl = Object.entries(stockVideoMap).find(([k]) => industryLower.includes(k))?.[1] || "https://coverr.co/videos/city-morning/mp4";
    if (!html.includes('id="hero-video"') && !html.includes("id='hero-video'")) {
      if (ytMatch && embedVideoUrl) {
        const iframeBlock = `<iframe id="hero-video" src="${embedVideoUrl}" frameborder="0" allow="autoplay;muted" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100vw;height:56.25vw;min-height:100%;min-width:177.77vh;z-index:0;pointer-events:none;" title="Hero background video"></iframe><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:1;"></div>`;
        html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>)/, (_m: string, open: string) => open.replace(/>$/, ` style="position:relative;overflow:hidden;">`) + iframeBlock);
      } else {
        const videoSrc = embedVideoUrl || stockUrl;
        const videoBlock = `<video id="hero-video" autoplay muted loop playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;" src="${videoSrc}"></video><div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:1;"></div>`;
        html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>)/, (_m: string, open: string) => open.replace(/>$/, ` style="position:relative;overflow:hidden;">`) + videoBlock);
      }
      html = html.replace(/(<(?:section|div)[^>]*id="hero"[^>]*>[\s\S]{0,200}?)(<(?:div|h1|h2|p|button|a)[^>]*(?:class|style)=)/, (_m: string, before: string, tag: string) => before + tag.replace(/style="/, 'style="position:relative;z-index:2;'));
      console.log(`[Step5] Video background injected: ${embedVideoUrl || stockUrl}`);
    }
  }

  // ── Social media links ────────────────────────────────────────────────────
  const socialLinks = [
    userInput.facebookPage  ? { name:"Facebook",  url: userInput.facebookPage.startsWith("http")  ? userInput.facebookPage  : `https://${userInput.facebookPage}`,                                   icon:"f",  color:"#1877F2" } : null,
    userInput.instagramUrl  ? { name:"Instagram", url: userInput.instagramUrl.startsWith("http")  ? userInput.instagramUrl  : `https://instagram.com/${userInput.instagramUrl.replace(/^@/,"")}`  , icon:"in", color:"#E1306C" } : null,
    userInput.linkedinUrl   ? { name:"LinkedIn",  url: userInput.linkedinUrl.startsWith("http")   ? userInput.linkedinUrl   : `https://${userInput.linkedinUrl}`                                    , icon:"li", color:"#0A66C2" } : null,
    userInput.tiktokUrl     ? { name:"TikTok",    url: userInput.tiktokUrl.startsWith("http")     ? userInput.tiktokUrl     : `https://tiktok.com/@${userInput.tiktokUrl.replace(/^@/,"")}`         , icon:"tt", color:"#010101" } : null,
  ].filter(Boolean) as { name: string; url: string; icon: string; color: string }[];
  if (socialLinks.length > 0) {
    const socialHtml  = socialLinks.map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.name}" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${s.color};color:#fff;text-decoration:none;font-size:12px;font-weight:700;margin:0 4px;">${s.icon}</a>`).join("");
    const socialBlock = `<div class="wg-social-links" style="display:flex;align-items:center;gap:4px;margin-top:8px;">${socialHtml}</div>`;
    html = html.replace(/<div[^>]*class="[^"]*(?:social|social-links|socials)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, (_m: string) => _m.includes("wg-social-links") ? _m : socialBlock);
    if (!html.includes("wg-social-links")) html = html.replace(/<footer/i, socialBlock + "\n<footer");
  }

  // ── Newsletter signup ─────────────────────────────────────────────────────
  const hasNewsletterAlready = html.includes('id="newsletter-form"') || html.includes('id="newsletter"') || /subscribe.*to.*newsletter|stay.*updated|stay.*in.*the.*loop|sign.*up.*newsletter/i.test(html);
  if (features.includes("Newsletter Signup") && !hasNewsletterAlready) {
    const beehiivPubId = (process.env.BEEHIIV_PUBLICATION_ID || "").startsWith("pub_") ? process.env.BEEHIIV_PUBLICATION_ID : `pub_${process.env.BEEHIIV_PUBLICATION_ID || ""}`;
    const beehiivEndpoint = `https://api.beehiiv.com/v2/publications/${beehiivPubId}/subscriptions/email`;
    const newsletterSection = `\n  <section id="newsletter" style="padding:64px 24px;background:linear-gradient(135deg,#0f1623 0%,#1a2332 100%);text-align:center;"><div style="max-width:600px;margin:0 auto;"><h2 style="color:#ffffff;font-size:2rem;font-weight:900;margin:0 0 12px;">Stay in the Loop</h2><p style="color:#94a3b8;font-size:1rem;margin:0 0 32px;">Get tips, updates and exclusive offers from ${userInput.businessName} straight to your inbox.</p><form id="newsletter-form" onsubmit="(function(e){e.preventDefault();var form=e.target;var em=form.querySelector('input[type=email]');var btn=form.querySelector('button');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${beehiivEndpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value,reactivate_existing:true,send_welcome_email:true})}).then(function(r){if(r.ok||r.status===201||r.status===200){btn.textContent='✓ Subscribed!';btn.style.background='#10b981';em.disabled=true;}else{throw new Error('Failed');}}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:480px;margin:0 auto;"><input type="email" name="email" placeholder="your@email.com.au" required style="flex:1;min-width:220px;padding:14px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#ffffff;font-size:0.95rem;outline:none;"><button type="submit" style="padding:14px 28px;border-radius:10px;background:#10b981;color:#000000;font-weight:700;font-size:0.95rem;border:none;cursor:pointer;white-space:nowrap;">Subscribe</button></form><p style="color:#475569;font-size:0.75rem;margin-top:16px;">No spam. Unsubscribe any time.</p></div></section>`;
    html = html.includes("<footer") ? html.replace(/<footer/i, newsletterSection + "\n<footer") : html.replace("</body>", newsletterSection + "\n</body>");
    console.log("[Step5] Newsletter signup section injected (Beehiiv direct)");
  }

  // ── Pop-up form ───────────────────────────────────────────────────────────
  if (features.includes("Pop-up Form") && !html.includes('id="wg-popup"')) {
    const beehiivPubId2  = (process.env.BEEHIIV_PUBLICATION_ID || "").startsWith("pub_") ? process.env.BEEHIIV_PUBLICATION_ID : `pub_${process.env.BEEHIIV_PUBLICATION_ID || ""}`;
    const beehiivEndpoint2 = `https://api.beehiiv.com/v2/publications/${beehiivPubId2}/subscriptions/email`;
    const popupHtml = `\n  <div id="wg-popup" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);align-items:center;justify-content:center;"><div style="background:#1a2332;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:48px 40px;max-width:440px;width:90%;position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.5);"><button onclick="document.getElementById('wg-popup').style.display='none';sessionStorage.setItem('wg-popup-closed','1');" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;line-height:1;">&times;</button><div style="text-align:center;margin-bottom:28px;"><div style="font-size:2.2rem;margin-bottom:12px;">&#128293;</div><h3 style="color:#ffffff;font-size:1.5rem;font-weight:900;margin:0 0 8px;">Don't Miss Out!</h3><p style="color:#94a3b8;font-size:0.95rem;margin:0;">Join our list and get exclusive offers from ${userInput.businessName}.</p></div><form id="wg-popup-form" onsubmit="(function(e){e.preventDefault();var em=e.target.querySelector('input[type=email]');var btn=e.target.querySelector('button[type=submit]');if(!em||!em.value)return;btn.textContent='Subscribing...';btn.disabled=true;fetch('${beehiivEndpoint2}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em.value,reactivate_existing:true,send_welcome_email:true})}).then(function(r){if(r.ok||r.status===201||r.status===200){btn.textContent='Thanks! Check your inbox';btn.style.background='#10b981';em.disabled=true;setTimeout(function(){document.getElementById('wg-popup').style.display='none';sessionStorage.setItem('wg-popup-closed','1');},2000);}else{throw new Error('Failed');}}).catch(function(){btn.textContent='Try again';btn.disabled=false;});})(event)"><input type="email" placeholder="your@email.com.au" required style="width:100%;box-sizing:border-box;padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#ffffff;font-size:0.95rem;margin-bottom:12px;outline:none;"><button type="submit" style="width:100%;padding:14px;border-radius:10px;background:#10b981;color:#000000;font-weight:800;font-size:1rem;border:none;cursor:pointer;">Get Exclusive Offers</button></form><p style="color:#475569;font-size:0.72rem;text-align:center;margin-top:14px;">No spam. Unsubscribe any time.</p></div></div>\n  <script>(function(){if(sessionStorage.getItem('wg-popup-closed'))return;var shown=false;function showPopup(){if(shown)return;shown=true;document.getElementById('wg-popup').style.display='flex';}setTimeout(showPopup,15000);document.addEventListener('mouseleave',function(e){if(e.clientY<=0)showPopup();});})();<\/script>`;
    html = html.replace("</body>", popupHtml + "\n</body>");
    console.log("[Step5] Pop-up form injected");
  }

  // ── Real testimonials swap ────────────────────────────────────────────────
  if (userInput.realTestimonials && userInput.realTestimonials.trim()) {
    const testimonialLines = userInput.realTestimonials.split(/\n+/).filter((l: string) => l.trim().length > 10);
    if (testimonialLines.length > 0) {
      const cards = testimonialLines.map((line: string) => {
        const match = line.match(/[""](.+)[""][\s—-]+(.+)/);
        const quote  = match ? match[1] : line.replace(/^[""]|[""]$/g, "").trim();
        const author = match ? match[2].trim() : "Verified Customer";
        return `<div style="background:rgba(255,255,255,0.06);border-radius:16px;padding:28px;border:1px solid rgba(255,255,255,0.1);"><div style="color:#f59e0b;font-size:1.1rem;margin-bottom:12px;">★★★★★</div><p style="color:#e2e8f0;font-size:0.95rem;line-height:1.7;margin:0 0 16px;">"${quote}"</p><p style="color:#10b981;font-weight:700;font-size:0.85rem;margin:0;">— ${author}</p></div>`;
      }).join("\n");
      const realTestimonialsSection = `<div class="wg-real-testimonials" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;padding:0 0 24px;">${cards}</div>`;
      html = html.replace(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i, (_m: string, open: string, _body: string, close: string) => {
        if (_m.includes("wg-real-testimonials")) return _m;
        return open + realTestimonialsSection + close;
      });
      console.log(`[Step5] Real testimonials injected (${testimonialLines.length} reviews)`);
    }
  }

  // ── Pad testimonials to at least 3 ───────────────────────────────────────
  {
    const auNames = ["Sarah M., Melbourne","James T., Brisbane","Emily R., Sydney","Michael K., Perth","Jessica L., Adelaide","Daniel W., Gold Coast"];
    const genReview = (industry: string, idx: number) => {
      const quotes: Record<string, string[]> = {
        medical: ["Absolutely outstanding service — I had answers within minutes.","Professional, caring, and incredibly responsive. Highly recommend.","Made a stressful situation so much easier. Five stars."],
        default: ["Exceptional service from start to finish. Could not be happier.","Professional, reliable, and genuinely great to work with.","Exactly what we needed — delivered on every promise."],
      };
      const pool = quotes[industry?.toLowerCase().includes("doctor")||industry?.toLowerCase().includes("medical")||industry?.toLowerCase().includes("health") ? "medical" : "default"];
      return `<div style="background:rgba(255,255,255,0.06);border-radius:16px;padding:28px 32px;border:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:12px;"><div style="color:#f59e0b;font-size:1.1rem;letter-spacing:2px;">★★★★★</div><p style="color:#e2e8f0;font-size:0.95rem;line-height:1.75;margin:0;">"${pool[idx % pool.length]}"</p><p style="color:#10b981;font-weight:700;font-size:0.85rem;margin:0;">— ${auNames[idx % auNames.length]}</p></div>`;
    };
    const testSection = html.match(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i);
    if (testSection) {
      const cardCount = (testSection[2].match(/★★★★★/g) || []).length;
      if (cardCount < 3) {
        const needed = 3 - cardCount;
        const extraCards = Array.from({length: needed}, (_, i) => genReview(userInput.industry || "", cardCount + i)).join("\n");
        html = html.replace(/(<(?:section|div)[^>]*id="testimonials"[^>]*>)([\s\S]*?)(<\/(?:section|div)>)/i,
          (_m: string, open: string, body: string, close: string) => {
            const grid = body.includes('display:grid') || body.includes('display: grid');
            if (grid) return open + body + extraCards + close;
            return open + body + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:20px;">${extraCards}</div>` + close;
          });
        console.log(`[Step5] Padded testimonials to 3 (was ${cardCount})`);
      }
    }
  }

  // ── Move orphaned sections from below footer ──────────────────────────────
  {
    const footerMatch = html.match(/<footer[\s>]/i) || html.match(/id=["']footer["']/i);
    if (footerMatch) {
      html = html.replace(/([\s\S]*?)(<\/footer>)([\s\S]*?)(<\/body>)/i, (_m: string, pre: string, ftClose: string, after: string, bodyClose: string) => {
        const orphaned = after.replace(/^\s+|\s+$/g, "");
        if (!orphaned || orphaned.length < 20) return _m;
        if (!/<(section|div|iframe)\b/i.test(orphaned)) return _m;
        console.log("[Step5] Moving orphaned sections from below footer to above it");
        return pre + orphaned + "\n" + ftClose + "\n" + bodyClose;
      });
    }
  }

  // ── Wire dead CTA buttons ─────────────────────────────────────────────────
  {
    const servicesTarget = requestedPageIds.includes("services") ? "services" : requestedPageIds.includes("about") ? "about" : "contact";
    const contactTarget  = requestedPageIds.includes("contact")  ? "contact"  : requestedPageIds.includes("booking") ? "booking" : "home";
    const bookingTarget  = requestedPageIds.includes("booking")  ? "booking"  : contactTarget;
    html = html.replace(/<(button|a)([^>]*)>(\s*(?:<[^>]+>\s*)*)(Learn More|learn more|View Services|view services|Explore Services|See Services|Our Services)(\s*(?:<\/[^>]+>\s*)*)<\/(button|a)>/gi,
      (_m: string, tag: string, attrs: string, pre: string, label: string, post: string) => {
        if (attrs.includes("onclick") || attrs.includes("navigateTo") || (attrs.includes("href") && !attrs.includes('href="#"') && !attrs.includes("href='#'"))) return _m;
        const nav = "window.navigateTo&&window.navigateTo('" + servicesTarget + "')";
        if (tag.toLowerCase() === "a") return "<a" + attrs + ' href="#" onclick="event.preventDefault();' + nav + '">' + pre + label + post + "</a>";
        return "<button" + attrs + ' onclick="' + nav + '">' + pre + label + post + "</button>";
      });
    html = html.replace(/<(button|a)([^>]*)>(\s*)(Get Started|Get in Touch|Contact Us|Book Now|Book Appointment|Book an Appointment)(\s*)<\/(button|a)>/gi,
      (_m: string, tag: string, attrs: string, pre: string, label: string, post: string) => {
        if (attrs.includes("onclick") || attrs.includes("navigateTo") || (attrs.includes("href") && !attrs.includes('href="#"') && !attrs.includes("href='#'"))) return _m;
        const tgt = /book/i.test(label) ? bookingTarget : contactTarget;
        const nav = "window.navigateTo&&window.navigateTo('" + tgt + "')";
        if (tag.toLowerCase() === "a") return "<a" + attrs + ' href="#" onclick="event.preventDefault();' + nav + '">' + pre + label + post + "</a>";
        return "<button" + attrs + ' onclick="' + nav + '">' + pre + label + post + "</button>";
      });
    const portalSlug = (userInput.slug || "").trim();
    if (portalSlug) {
      html = html.replace(/(<span[^>]*)>(\s*account_circle\s*)<\/span>/gi, (_m: string, attrs: string, inner: string) => {
        if (attrs.includes("data-wg-portal")) return _m;
        return `<a href="/c/${portalSlug}" title="Client Portal" style="text-decoration:none"><span${attrs} data-wg-portal="1">${inner}</span></a>`;
      });
    }
  }

  // ── Strip Stitch navigateTo scripts ───────────────────────────────────────
  if (!savedHtmlForRebuild || isUsingRawStitchForRebuild) {
    html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (m: string, body: string) => {
      const definesNavigateTo = /function\s+navigateTo/.test(body) || /window\.navigateTo\s*=/.test(body) || /var\s+navigateTo\s*=/.test(body);
      const definesPageSwitch = /function\s+showPage/.test(body) || /function\s+switchPage/.test(body) || /\.page-section['"\s]*[,{]/.test(body);
      if (definesNavigateTo || definesPageSwitch) {
        console.log("[Step5] Stripped Stitch script (" + body.length + " chars, navigateTo=" + definesNavigateTo + " pageSwitch=" + definesPageSwitch + ")");
        return "";
      }
      return m;
    });
  } else {
    console.log("[Step5] Rebuild mode — skipping script strip to preserve injected navigateTo");
  }

  // showPage() → navigateTo()
  const showPageCount = (html.match(/showPage\s*\(/g) || []).length;
  if (showPageCount > 0) {
    html = html.replace(/\bshowPage\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (_m: string, pageId: string) => `navigateTo('${pageId.toLowerCase()}')`);
    console.log(`[Step5] Replaced ${showPageCount} showPage() calls with navigateTo()`);
  }

  // ── Strip markdown from visible text ─────────────────────────────────────
  {
    const preserved: string[] = [];
    let stripped = html.replace(/<(script|style)([\s\S]*?)<\/\1>/gi, (m: string) => { preserved.push(m); return `\x00PRESERVE${preserved.length - 1}\x00`; });
    stripped = stripped.replace(/>([^<]+)</g, (_m: string, text: string) => `>${text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")}<`);
    html = stripped.replace(/\x00PRESERVE(\d+)\x00/g, (_m: string, idx: string) => preserved[Number(idx)]);
    const mdCount = (html.match(/\*\*[^<*]+\*\*/g) || []).length;
    if (mdCount === 0) console.log("[Step5] Markdown asterisks stripped from visible text");
    else console.warn(`[Step5] ${mdCount} markdown patterns remaining after strip`);
  }

  // ── Strip dead Stitch-generated policy anchor links ───────────────────────
  // Stitch often outputs <a href="#">Privacy Policy</a> / <a href="#">Terms...</a>
  // in footers. These are dead. Replace with navigateTo() anchors so they wire
  // up correctly to the page-section divs injected by auditor.ts.
  // Only replace anchors that have NO existing onclick (i.e. not already fixed).
  html = html.replace(
    /<a([^>]*)href=["']#["']([^>]*)>(Privacy\s*Policy|Privacy)<\/a>/gi,
    (_m: string, before: string, after: string, label: string) => {
      if (/onclick/i.test(before) || /onclick/i.test(after)) return _m;
      return `<a${before}href="#"${after} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('privacy')">${label}</a>`;
    }
  );
  html = html.replace(
    /<a([^>]*)href=["']#["']([^>]*)>(Terms(?:\s+of\s+Service|\s+&amp;\s+Conditions|\s+and\s+Conditions|\s+Conditions|s)?)<\/a>/gi,
    (_m: string, before: string, after: string, label: string) => {
      if (/onclick/i.test(before) || /onclick/i.test(after)) return _m;
      return `<a${before}href="#"${after} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('terms')">${label}</a>`;
    }
  );

  // ── SEO meta tags + Open Graph ────────────────────────────────────────────
  if (!html.includes('property="og:title"')) {
    const pageTitle = spec.projectTitle || userInput.businessName;
    const metaDesc  = (`${userInput.businessName} — ${userInput.usp || userInput.industry} in ${userInput.city || (userInput.businessAddress ? userInput.businessAddress.split(",").slice(-2).join(",").trim() : "Australia")}. ${userInput.goal || ""}`).slice(0, 160).trim();
    const lsiStr    = Array.isArray(spec.lsiKeywords) && spec.lsiKeywords.length > 0 ? spec.lsiKeywords.slice(0, 10).join(", ") : userInput.industry;
    const siteUrl   = rawDomain ? `https://${rawDomain}` : "";
    const seoMeta   = `\n    <!-- SEO: WebGecko auto-generated -->\n    <meta name="description" content="${metaDesc.replace(/"/g, "&quot;")}">\n    <meta name="keywords" content="${lsiStr.replace(/"/g, "&quot;")}">\n    <meta name="robots" content="index, follow">\n    ${siteUrl ? `<link rel="canonical" href="${siteUrl}">` : ""}\n    <meta property="og:type" content="website">\n    <meta property="og:title" content="${pageTitle.replace(/"/g, "&quot;")}">\n    <meta property="og:description" content="${metaDesc.replace(/"/g, "&quot;")}">\n    ${siteUrl ? `<meta property="og:url" content="${siteUrl}">` : ""}\n    <meta name="twitter:card" content="summary_large_image">\n    <meta name="twitter:title" content="${pageTitle.replace(/"/g, "&quot;")}">\n    <meta name="twitter:description" content="${metaDesc.replace(/"/g, "&quot;")}">`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + seoMeta);
    } else {
      const charsetMatch = html.match(/<meta[^>]*charset[^>]*>/i);
      if (charsetMatch) html = html.replace(charsetMatch[0], charsetMatch[0] + seoMeta);
    }
    console.log("[Step5] SEO meta tags injected");
  }

  return html;
}
