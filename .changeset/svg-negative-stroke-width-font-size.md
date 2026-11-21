---
'@weasel-js/svg': patch
---

SVG import ignores a negative `stroke-width` or `font-size`, with a warning, so the value below it or the inherited one stands, as in a browser.

<!-- entry: fix data -->
