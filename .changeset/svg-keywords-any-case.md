---
'@weasel-js/svg': patch
---

SVG properties read keywords in any case, as CSS does. `stroke-linejoin: Round`, `fill-rule: EvenOdd`, and `display="None"` now take effect.

<!-- entry: fix visual -->
