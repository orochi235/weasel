---
'@weasel-js/cursor': patch
---

A glyph cursor with a blank `fallback` falls back to `default`, where it baked a declaration the browser ignored, and one holding `;`, `{` or `}` throws a `RangeError`.

<!-- entry: fix -->
