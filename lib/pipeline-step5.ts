// lib/pipeline-step5.ts
// Step 5 — Code-only fix pass.
// Extracted from app/api/inngest/route.ts to reduce monolith size.
// Contains all regex/string-based post-processing: CTA wiring, placeholder
// replacement, maps, video, social links, newsletter, popup, testimonials,
// script stripping, markdown cleaning, and SEO meta injection.

import { resolveStitchClasses, normalizePageId } from "./pipeline-helpers";
import { load as cheerioLoad } from "cheerio";

function isStitchImgUrl(src: string): boolean {
  return src.includes("lh3.googleusercontent.com/aida");
}

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

  // Only inject stitch-token CSS if Tailwind CDN is not already present.
  // Stitch always ships with Tailwind CDN which resolves all classes at runtime — injecting
  // a redundant 1900-line CSS blob on top breaks the visual output.
  let html = (params.html.includes('cdn.tailwindcss.com') || params.html.includes('tailwindcss'))
    ? params.html
    : resolveStitchClasses(params.html);
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

  // ── Strip Stitch placeholder footer links (Discord, Community, etc.) ─────────
  // Stitch generates generic social/community footer links that aren't real for the client.
  // Remove nav items linking to generic platforms client didn't set up.
  html = html.replace(/<li[^>]*>\s*<a[^>]*href=["']#["'][^>]*>\s*(Discord|Community|Forum|Reddit|Twitch|Slack|WhatsApp Group)\s*<\/a>\s*<\/li>/gi, '');
  html = html.replace(/<a[^>]*href=["']#["'][^>]*>\s*(Discord|Community|Forum|Reddit|Twitch)\s*<\/a>/gi, '');

  // ── Strip newsletter section if client did not request it ─────────────────
  // Stitch sometimes generates a newsletter/email signup section unprompted.
  if (!features.includes("Newsletter Signup")) {
    html = html.replace(/<section[^>]*id=["']newsletter["'][^>]*>[\s\S]*?<\/section>/gi, '');
    html = html.replace(/<div[^>]*id=["']newsletter["'][^>]*>[\s\S]*?<\/div>/gi, '');
    // Strip newsletter sections by heading text
    html = html.replace(/<section[^>]*>[\s\S]{0,200}?(?:Stay in the Loop|Subscribe to Our Newsletter|Join Our Newsletter|Newsletter Signup)[\s\S]*?<\/section>/gi, '');
    // Strip newsletter input blocks inside footer (Stitch often puts email input in footer)
    html = html.replace(/<(?:div|section)[^>]*>[\s\S]{0,300}?(?:Newsletter|Your email|Stay.*loop)[\s\S]{0,400}?<input[^>]*type=["']email["'][^>]*>[\s\S]{0,200}?<\/(?:div|section)>/gi, (m: string) => {
      // Only strip if it's not inside a named contact form  
      if (m.includes('id="contact"') || m.includes('id="newsletter-form"')) return m;
      return '';
    });
  }

  // ── Wire "Connect" CTA to contact page ──────────────────────────────────────
  html = html.replace(/<(button|a)([^>]*)>\s*Connect\s*<\/(button|a)>/gi, (_m: string, tag: string, attrs: string) => {
    if (/onclick|href=["'][^#]/i.test(attrs)) return _m; // already wired
    if (tag.toLowerCase() === 'a') {
      return `<a${attrs} href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('contact')">Connect</a>`;
    }
    return `<button${attrs} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('contact')">Connect</button>`;
  });

  // ── Strip Stitch "Sign In" / "Log In" buttons client didn't request ──────────
  // Stitch sometimes generates auth buttons. Remove any that aren't wired to real pages.
  html = html.replace(/<(?:button|a)([^>]*)>\s*(?:Sign In|Log In|Login|Sign Up|Register|Create Account)\s*<\/(?:button|a)>/gi, (m: string, attrs: string) => {
    // Keep if it has a real href (not #) or a real onclick to a known page
    if (/href=["'](?!#)[^"']+["']/i.test(attrs)) return m;
    if (/navigateTo|window\.open/i.test(attrs)) return m;
    return ''; // strip placeholder auth buttons
  });

  // ── Wire Stitch footer href="#" Privacy/Terms links to navigateTo ──────────
  // Stitch outputs <a href="#">Privacy Policy</a> etc. in the footer. Wire them.
  // Wire all href="#" footer/nav links to correct pages
  const linkMap: [RegExp, string][] = [
    [/Privacy\s*Policy|Privacy/i, 'privacy'],
    [/Terms\s+of\s+Service|Terms\s*&amp;\s*Conditions|Terms/i, 'terms'],
    [/^Contact$/i, 'contact'],
    [/^Shipping$/i, 'contact'],
    [/^Support$/i, 'contact'],
    [/^Brisbane\s*HQ$/i, 'contact'],
  ];
  html = html.replace(/<a([^>]*)href=["']#["']([^>]*)>([\s\S]*?)<\/a>/gi, (m: string, before: string, after: string, inner: string) => {
    if (/onclick/i.test(before) || /onclick/i.test(after)) return m;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    for (const [pattern, target] of linkMap) {
      if (pattern.test(text)) {
        return `<a${before}href="#"${after} onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${target}')">${inner}</a>`;
      }
    }
    return m;
  });

  // ── Contact form cleanup ──────────────────────────────────────────────────
  html = html.replace(/<(?:div|p|label|tr)[^>]*>[^<]*(?:Business Name|Company Name|Organisation|Organization|Project (?:Goals?|Type|Details?|Description)|Subject|Username|Password|Confirm Password|Account Type|Service Type|Service Interest|How did you hear)[^<]*<\/(?:div|p|label|tr)>\s*/gi, '');
  html = html.replace(/<(?:input|select|textarea)[^>]*(?:name=["'](?:business|company|organisation|organization|subject|username|password|confirm|project_type|service_type|how_hear)[^"']*["']|placeholder=["'][^"']*(?:Business Name|Company|Organization|Project Type|Service Type|Password|Username)[^"']*["'])[^>]*>(?:<\/(?:input|select|textarea)>)?/gi, '');
  html = html.replace(/(?:Initialize Transmission|Send Brief|Submit Request|Submit Inquiry|Launch Project|Start Project|Begin Project)/gi, 'Send Message');
  html = html.replace(/(?:Start Your Project|Launch Your Project|Begin Your Project|Project Inquiry|Project Brief|Start a Project)/gi, 'Get in Touch');

  // ── Strip "Headquarters" label — replace with plain "Our Location" for tradie sites ──
  html = html.replace(/\bHEADQUARTERS\b/g, 'Our Location');
  html = html.replace(/\bHeadquarters\b/g, 'Location');

  // ── If site has booking, reframe contact as enquiries/support not quote requests ─
  if (hasBookingFeature) {
    // Only change heading text inside the contact section — not elsewhere
    const contactIdx = html.indexOf('id="contact"');
    if (contactIdx !== -1) {
      const contactChunk = html.slice(contactIdx, contactIdx + 3000);
      const updated = contactChunk
        .replace(/Request a Quote/gi, 'Send an Enquiry')
        .replace(/Get a Quote/gi, 'Get in Touch')
        .replace(/Submit Request/gi, 'Send Message')
        .replace(/Project Details/gi, 'How Can We Help?')
        .replace(/Describe your (?:carpentry|project|service) needs/gi, 'Tell us how we can help...')
        .replace(/placeholder="Describe your[^"]*"/gi, 'placeholder="Tell us how we can help..."');
      html = html.slice(0, contactIdx) + updated + html.slice(contactIdx + 3000);
    }
  }

  // ── Nav link wiring ───────────────────────────────────────────────────────
  // Rewrites both bare href="#" AND anchor href="#section" links in nav/header
  // into navigateTo() calls. Stitch generates href="#services" style anchors
  // which look fine but break multi-page navigation entirely.
  const navLinkMap: Record<string, string> = {
    "home":"home","about":"about","about us":"about","services":"services","our services":"services",
    "what we do":"services","gallery":"gallery","portfolio":"gallery","our work":"gallery",
    "contact":"contact","contact us":"contact","get in touch":"contact","faq":"faq","faqs":"faq",
    "pricing":"pricing","packages":"pricing","shop":"shop","blog":"blog","team":"team",
    "booking":"booking","testimonials":"testimonials","reviews":"testimonials",
    "view portfolio":"gallery","view all work":"gallery","our projects":"gallery",
  };
  // Match both href="#" and href="#anything"
  html = html.replace(/<a([^>]*href=["']#[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
    if (attrs.includes('navigateTo') || attrs.includes('scrollIntoView')) return match;
    if (/href=["'](?:mailto:|tel:)/i.test(attrs)) return match;
    const txt = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();

    // First: try to resolve by link text via navLinkMap
    let target = navLinkMap[txt] || Object.entries(navLinkMap).find(([k]) => txt.includes(k))?.[1];

    // Second: if text didn't match, try the anchor fragment itself (href="#services" → "services")
    if (!target) {
      const hrefMatch = attrs.match(/href=["']#([^"']+)["']/i);
      if (hrefMatch) {
        const fragment = hrefMatch[1].toLowerCase();
        target = navLinkMap[fragment] || Object.entries(navLinkMap).find(([k]) => fragment.includes(k))?.[1] || fragment;
      }
    }

    if (!target) return match;
    // Only wire if the target page/section actually exists in the HTML
    if (!html.includes(`id="${target}"`) && !html.includes(`data-page="${target}"`)) return match;
    const attrsNoHref = attrs.replace(/\s*href=["'][^"']*["']/gi, '');
    return `<a${attrsNoHref} href="#" onclick="event.preventDefault();window.navigateTo&&window.navigateTo('${target}')">${inner}</a>`;
  });

  // ── Maps injection (cheerio-based — always goes INSIDE contact section) ─────
  if (businessAddress) {
    const hasRealMap = /<iframe[^>]*(?:google\.com\/maps|maps\.googleapis)[^>]*>/i.test(html);
    if (hasRealMap) {
      console.log("[Step5] Stitch already has Google Maps — skipping map injection");
    } else {
      const $m = cheerioLoad(html, { xmlMode: false });

      const mapsIframe = process.env.GOOGLE_MAPS_API_KEY
        ? `<iframe width="100%" height="320" style="border:0;display:block;border-radius:12px;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(businessAddress)}"></iframe>`
        : `<iframe width="100%" height="320" style="border:0;display:block;border-radius:12px;" loading="lazy" allowfullscreen src="https://maps.google.com/maps?q=${encodeURIComponent(businessAddress)}&output=embed" title="Map"></iframe>`;
      const mapBlock = `<div style="width:100%;border-radius:12px;overflow:hidden;margin-top:24px;">${mapsIframe}</div>`;

      // Strategy 1: replace Stitch's map placeholder patterns:
      //   - <img data-location="..."> (Stitch generates a fake map image)
      //   - div/section with map-related text or data-icon=map
      let injected = false;

      // Pattern A: img with data-location or data-alt mentioning map
      $m("img[data-location], img[data-alt*='map'], img[data-alt*='Map']").each((_, el) => {
        if (injected) return;
        const $el = $m(el);
        // Only replace Stitch-generated map images (aida URLs or placeholder)
        const src = $el.attr("src") || "";
        if (isStitchImgUrl(src) || $el.attr("data-location")) {
          const $parent = $el.parent();
          $parent.replaceWith(mapBlock);
          injected = true;
          console.log("[Step5] Map replaced Stitch data-location img placeholder");
        }
      });

      // Pattern B: container div with "Map View" text or data-icon=map inside contact
      if (!injected) {
        $m("[id='contact'], [data-page='contact']").find("div, section").each((_, el) => {
          if (injected) return;
          const $el = $m(el);
          const inner = $el.html() || "";
          const text = $el.text().trim();
          if (
            /map.*view|map.*placeholder|\[\s*google.*map|\[\s*map/i.test(inner) ||
            (text.length < 100 && /map.*view|map view/i.test(text)) ||
            ($el.find("[data-icon='map'], .material-symbols-outlined").length > 0 && text.length < 150)
          ) {
            $el.replaceWith(mapBlock);
            injected = true;
            console.log("[Step5] Map replaced text placeholder inside contact section");
          }
        });
      }

      // Strategy 2: append to contact section's right-hand column or last child div
      if (!injected) {
        const contactSection = $m("[id='contact'], [data-page='contact']").first();
        if (contactSection.length) {
          // Try to find the contact details column (right side — has phone/email/address)
          const detailsCol = contactSection.find("div").filter((_, el) => {
            const t = $m(el).text();
            return t.includes(businessAddress.split(",")[0]) || /0[0-9]{9}/.test(t);
          }).first();
          if (detailsCol.length) {
            detailsCol.append(mapBlock);
          } else {
            contactSection.append(mapBlock);
          }
          injected = true;
          console.log("[Step5] Map appended inside contact section");
        }
      }

      if (!injected) console.log("[Step5] Map skipped — no contact section found");
      html = $m.html() || html;
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

  // ── Upgrade bare navigateTo( calls to window.navigateTo( ────────────────────
  // Stitch outputs onclick="navigateTo('shop')" — bare calls work but normalise for safety
  html = html.replace(/(<(?:a|button)[^>]*onclick=["'][^"']*?)(?<![.\w])navigateTo\(/g, '$1window.navigateTo(');

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

    // ── Strip Stitch page-switch CSS rules from <style> blocks ───────────────
    // Stitch outputs .page-section{display:none} / .page-section.active{display:block}
    // These fight the pipeline's [data-wg-mp] authority. Strip ONLY those specific rules —
    // NEVER remove the entire <style> block or other component styles (.bento-card, .btn-primary, etc.)
    html = html.replace(/(<style([^>]*)>)([\s\S]*?)(<\/style>)/gi, (_m: string, open: string, attrs: string, body: string, close: string) => {
      if (attrs.includes("data-wg")) return _m; // Never touch WG-managed styles
      const cleaned = body
        // .page-section { ... } — the display:none rule Stitch injects
        .replace(/\.page-section\s*\{[^}]*\}/g, "")
        // .page-section.active { ... } — Stitch's show rule (WG overrides this)
        .replace(/\.page-section\.active\s*\{[^}]*\}/g, "")
        // [data-page] { display:none } — alternate form
        .replace(/\[data-page\](?::not\([^)]+\))?\s*\{[^}]*display\s*:\s*none[^}]*\}/gi, "")
        // [data-page].active { display:block } — alternate form
        .replace(/\[data-page\]\.active\s*\{[^}]*display\s*:\s*block[^}]*\}/gi, "");
      if (cleaned !== body) {
        console.log("[Step5] Surgically removed page-switch CSS rules from <style> block (kept " + cleaned.length + "/" + body.length + " chars)");
        return open + cleaned + close;
      }
      return _m;
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
