---
'@weasel-js/cursor': patch
---

A glyph cursor's `fallback` that is not a cursor keyword, optionally after `url(…)` images, throws a `RangeError`. That includes a misspelled keyword and a `url()` with no keyword after it.

<!-- entry: fix -->
