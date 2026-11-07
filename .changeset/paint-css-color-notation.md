---
'@weasel-js/paint': patch
'@weasel-js/theme': patch
---

`colorLiteralToCss` writes `hsl`, `hwb`, `lab`, `lch`, `oklab` and `oklch` literals as their own CSS functions (`hsl(210 50% 40%)`), and keeps `color()` for the predefined spaces. Before, it wrote `color(hsl …)` and `color(lab …)`, which CSS rejects. A space CSS has no notation for now gives `null` instead of an invalid `color()`. The writer is exported as `cssColorNotation`, and `loadDTCG` writes DTCG color objects through it.
