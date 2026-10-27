---
'@weasel-js/font': patch
'@weasel-js/text': patch
---

`glyphIn` and `resolveGlyph` take an optional object to write their answer into, which they then return, so a caller that copies the fields out at once allocates nothing a code point. Text layout uses it: a HUD readout of 5,000 glyphs changing every frame allocated 4.70 MB a frame before and 4.48 after (teitou, headless Chromium, `tests/perf/hud-vs-dom.spec.ts` with `HVD_ALLOC=1`).
