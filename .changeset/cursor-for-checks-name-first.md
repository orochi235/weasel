---
'@weasel-js/cursor': patch
---

`cursorFor` throws for a glyph name the set lacks every time, not only until another call has baked a cursor whose cache key matches it.

<!-- entry: fix -->
