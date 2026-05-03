# WebGecko Pipeline Error Log
_Updated a
---

## ISSUE 018 — Multi-page navigateTo broken: Stitch's .active CSS toggle overridden by inline styles
**Symptom:** After fix for Issue 017 (step4b skip), nav buttons on multi-page sites still do nothing.  
**Root cause:** Step 5 was stripping Stitch's `navigateTo` + `toggleDrawer` script (the "strip conflicting scripts" pass). Our `injectEssentials` then injected its own `window.navigateTo` which used `style.display = "none/block"` inline toggling. But Stitch's CSS is `.page-section { display: none }` / `.page-section.active { display: block }` — class-based. Inline styles override CSS, so once our version ran and set `style.display = "none"`, removing `.active` did nothing and pages stayed hidden forever.  
**Fix applied:**  
- `app/api/inngest/route.ts` step5: wrapped script-stripping in `if (!isMultiPage)` — Stitch's `navigateTo` and `toggleDrawer` are preserved for multi-page builds  
- `lib/pipeline-helpers.ts` `injectEssentials`: `window.navigateTo` definition now guarded with `if (!window.navigateTo)` — won't override Stitch's version; added a thin wrapper that just closes the mobile drawer and delegates to the original  
- Multi-page init now only manages `.active` class (never sets inline `style.display`) to stay compatible with Stitch's CSS  
**Status:** ✅ Fixed — deploy and rebuild
