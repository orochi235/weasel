---
'@weasel-js/paint': patch
---

Gradient stops blend premultiplied by alpha, as CSS blends them, so a stop fading to `transparent` keeps its color instead of darkening toward black, in the painted gradient, its preview swatch and PDF export alike.

<!-- entry: fix visual -->
