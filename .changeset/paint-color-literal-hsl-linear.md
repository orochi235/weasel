---
'@weasel-js/paint': patch
---

`colorLiteralToHex` converts `hsl` and `srgb-linear` literals, so `paletteColorAt` answers a palette entry in either space with its color rather than the fallback, and `colorLiteralToCss` writes them as hex.

<!-- entry: fix -->
