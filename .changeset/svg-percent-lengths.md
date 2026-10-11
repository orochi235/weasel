---
'@weasel-js/svg': patch
---

`parseSvg` read a geometry attribute like `width="100%"` or `r="5mm"` as its bare number with no warning, so the usual full-page background `<rect width="100%" height="100%">` imported 100 units square. A percentage on a shape, `<image>`, or `<text>` position now resolves against the nearest `<svg>`'s `viewBox` (or its `width` and `height`), and any other unit is still read as its number but reported, the way `stroke-width` already is.
