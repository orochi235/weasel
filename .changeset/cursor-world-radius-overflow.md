---
'@weasel-js/cursor': patch
---

`brushRing(radius, 'world')` and `resolveCursor` throw a `RangeError` for a world radius too large to draw, rather than show no cursor.

<!-- entry: fix -->
