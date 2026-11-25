---
'@weasel-js/cursor': patch
---

`resolveCursor` throws a `RangeError` for an infinite size or world radius, as `cursorFor` does, rather than drawing at 24 px.

<!-- entry: fix -->
