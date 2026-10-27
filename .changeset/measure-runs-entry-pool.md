---
'@weasel-js/text': patch
---

Laying out text reuses the per-code-point entries it measures into, instead of allocating one object per code point each time. A HUD readout of 5,000 glyphs changing every frame allocated 5.20 MB a frame before and 4.70 after (teitou, headless Chromium, `tests/perf/hud-vs-dom.spec.ts` with `HVD_ALLOC=1`). Up to 4,096 entries are kept between layouts.
