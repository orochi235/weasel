---
'@weasel-js/paint': patch
---

An OKLCh color a rounding error past the sRGB edge keeps its full chroma when mapped into sRGB. Pure red written as `oklch(62.796% 0.25768 29.2339deg)` comes out `#ff0000` from `oklchDegToHex`, `colorLiteralToHex` and OKLCh blends.

<!-- entry: fix visual -->
