---
"@weasel-js/cursor": patch
---

`placeCursorPath` reads an arc whose flags have no separator (`A 5 5 0 015 5`) as SVG reads it.

`@weasel-js/cursor` now depends on `@weasel-js/geom`, and reads and writes path data through geom's `tokenizePathData` and `trimNumber`.

<!-- entry: fix -->
