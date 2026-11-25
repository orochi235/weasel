---
'@weasel-js/cursor': patch
---

`brushRing` throws a `RangeError` for a radius of minus infinity, or one whose px size overflows, rather than drawing a 24 px ring.

<!-- entry: fix -->
