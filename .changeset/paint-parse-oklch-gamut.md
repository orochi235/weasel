---
'@weasel-js/paint': patch
---

`parseColor` maps an out-of-gamut `oklch()` or `oklab()` into sRGB by reducing chroma. It now agrees with `oklchDegToHex` and `colorLiteralToHex` on the same color.

<!-- entry: fix visual -->
