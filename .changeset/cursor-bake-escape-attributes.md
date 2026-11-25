---
'@weasel-js/cursor': patch
---

`bakeCursor` escapes the path data and colors it writes into the cursor's SVG, so an accent fill such as `url("#g")` bakes a cursor the browser shows rather than silently dropping.

<!-- entry: fix -->
