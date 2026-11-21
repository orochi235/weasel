---
'@weasel-js/svg': patch
---

SVG import paints a fill or stroke whose `url(#…)` it cannot resolve, with no fallback color, as `none`. Browsers do the same; the import still warns.

<!-- entry: fix visual -->
