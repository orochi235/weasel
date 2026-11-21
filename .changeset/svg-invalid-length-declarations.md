---
'@weasel-js/svg': patch
---

SVG import ignores a `stroke-width`, `font-size`, dash, `letter-spacing`, marker, or `clip-path` value CSS rejects. The value beneath it stands, as in a browser, so `stroke-width: thick` over `stroke-width="5"` strokes 5 wide.

<!-- entry: fix visual -->
