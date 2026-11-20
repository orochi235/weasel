---
'@weasel-js/paint': patch
---

`colorLiteralToHex` converts `hsl` and `srgb-linear` literals, so `paletteColorAt` answers their color, not the fallback.

<!-- entry: fix -->
