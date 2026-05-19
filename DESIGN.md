# WebGecko — Site Design System
> Read this file before generating any HTML. These rules are mandatory and override all defaults.

## Typography
- **Primary font:** `'Inter', system-ui, -apple-system, sans-serif` — body, nav, buttons, forms
- **Display font:** `'Space Grotesk', 'Inter', sans-serif` — headings (h1–h3) only
- **Monospace:** `'JetBrains Mono', monospace` — code snippets, price tags, stat numbers only
- Import via: `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet">`
- Base size: `16px` / Line height: `1.6` / Letter spacing headings: `-0.03em`
- **Never use:** Arial, Helvetica, Times, Georgia, generic serif

## Layout & Spacing
- Max content width: `1200px` centred with `margin: 0 auto; padding: 0 24px`
- Section padding: `80px 24px` desktop / `60px 20px` mobile
- Card gap: `24px` / Inner card padding: `28px 32px`
- Border radius: `14px` cards / `10px` inputs / `8px` buttons / `999px` pills/badges
- Grid: CSS Grid preferred. `gap: 24px`. Never use tables for layout.

## Colour System
> Colours are set per-client via CSS variables at `:root`. Never hardcode hex values — always use these var() names.

```css
:root {
  --clr-bg: /* client primary bg — set by pipeline */;
  --clr-surface: /* card/panel surface — set by pipeline */;
  --clr-accent: /* primary CTA colour — set by pipeline */;
  --clr-accent-sub: /* secondary accent — set by pipeline */;
  --clr-text: /* primary text — set by pipeline */;
  --clr-text-muted: /* secondary/muted text — set by pipeline */;
  --clr-border: /* border colour — set by pipeline */;
}
```

### Colour Rules
- Background: `var(--clr-bg)` on `<body>` and full-bleed sections
- Cards/panels: `var(--clr-surface)` with `border: 1px solid var(--clr-border)`
- Primary buttons: `background: var(--clr-accent); color: #fff`
- Ghost/secondary buttons: `background: transparent; border: 1.5px solid var(--clr-accent); color: var(--clr-accent)`
- Links: `var(--clr-accent)` on hover, `var(--clr-text)` default
- Accent numbers/highlights: `var(--clr-accent)` or `var(--clr-accent-sub)`
- NEVER use pure black (`#000`) or pure white (`#fff`) as backgrounds

## Component Rules

### Buttons
```css
/* Primary */
padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 1rem;
background: var(--clr-accent); color: #fff; border: none; cursor: pointer;
transition: opacity 0.2s, transform 0.15s;
&:hover { opacity: 0.88; transform: translateY(-1px); }

/* Ghost */
padding: 13px 27px; border-radius: 8px; font-weight: 600; font-size: 1rem;
background: transparent; border: 1.5px solid var(--clr-accent); color: var(--clr-accent);
transition: background 0.2s;
&:hover { background: var(--clr-accent)18; }
```

### Cards
```css
background: var(--clr-surface);
border: 1px solid var(--clr-border);
border-radius: 14px;
padding: 28px 32px;
box-shadow: 0 4px 24px rgba(0,0,0,0.18);
transition: box-shadow 0.2s, transform 0.2s;
&:hover { box-shadow: 0 8px 40px rgba(0,0,0,0.28); transform: translateY(-2px); }
```

### Form Inputs
```css
width: 100%; padding: 14px 16px; border-radius: 10px;
background: rgba(255,255,255,0.06); border: 1px solid var(--clr-border);
color: var(--clr-text); font-size: 1rem; outline: none; box-sizing: border-box;
transition: border-color 0.2s, box-shadow 0.2s;
&:focus { border-color: var(--clr-accent); box-shadow: 0 0 0 3px var(--clr-accent)22; }
```

### Navigation (Sticky Header)
```css
position: sticky; top: 0; z-index: 100;
background: var(--clr-bg)e8; backdrop-filter: blur(12px);
border-bottom: 1px solid var(--clr-border);
padding: 0 32px; height: 68px;
display: flex; align-items: center; justify-content: space-between;
```
- Logo: `font-family: 'Space Grotesk'; font-weight: 700; font-size: 1.25rem`
- Nav links: `font-size: 0.9rem; font-weight: 500; opacity: 0.8; &:hover { opacity: 1 }`
- Active page link: `color: var(--clr-accent); font-weight: 600`

### Section Headings
```css
h2 { font-family: 'Space Grotesk'; font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 700; letter-spacing: -0.03em; }
/* Accent underline on section headings: */
h2::after { content:''; display:block; width:48px; height:3px; background:var(--clr-accent); border-radius:2px; margin-top:12px; }
```

### Hero Section
- Min-height: `100vh` with `display:flex; align-items:center`
- TWO-COLUMN layout: text left (55%), visual right (45%)
- Headline: `clamp(2.4rem, 5.5vw, 4rem)` Space Grotesk 800 weight
- MANDATORY: fade-in-up animation on headline (0.6s ease-out)
- MANDATORY: floating stat/badge cards on the visual side
- MANDATORY: trust badge row above headline (pill badges with accent border)
- Right column: CSS gradient orb/blob OR client hero image (never placeholder img URLs)

### Badges / Pills
```css
display: inline-flex; align-items: center; gap: 6px;
padding: 5px 12px; border-radius: 999px;
border: 1px solid var(--clr-accent)44;
background: var(--clr-accent)12;
font-size: 0.78rem; font-weight: 600; color: var(--clr-accent);
```

### Stat Numbers (social proof bars)
```css
font-family: 'Space Grotesk'; font-size: 2rem; font-weight: 800;
color: var(--clr-accent); letter-spacing: -0.04em;
```

## Animations (CSS only — no JS libraries)
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-10px); }
}
/* Usage: animation: fadeInUp 0.6s ease-out both; */
/* Float cards: animation: float 4s ease-in-out infinite; */
```

## What to NEVER do
- ❌ Never use `font-family: Arial` or `Helvetica` or `Times`
- ❌ Never hardcode client colours as hex — always CSS variables
- ❌ Never use `<table>` for layout
- ❌ Never use placeholder image URLs (picsum.photos, placehold.it, unsplash.com URLs in src)
- ❌ Never put contact info or map AFTER `</footer>`
- ❌ Never render the same section twice (no duplicate `id=contact`, `id=faq` etc.)
- ❌ Never use inline `style="font-family: serif"` on headings
- ❌ Never make the hero a simple centred headline + one button — it must be two-column with depth
- ❌ Never use Bootstrap, Tailwind, or any CSS framework — pure CSS only
- ❌ Never generate `<img src="https://images.unsplash.com/...">` or any external image URL

## Footer
```html
<footer style="background:var(--clr-surface);border-top:1px solid var(--clr-border);padding:40px 24px;text-align:center">
  <p style="color:var(--clr-text-muted);font-size:0.85rem">
    © {YEAR} {BUSINESS_NAME}. All rights reserved.
    <a href="/privacy" style="color:var(--clr-accent);margin-left:16px">Privacy Policy</a>
    <a href="/terms" style="color:var(--clr-accent);margin-left:16px">Terms of Service</a>
  </p>
</footer>
```
