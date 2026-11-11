---
"@weasel-js/geom": patch
---

`@weasel-js/geom` exports `tokenizePathData(d)`, the SVG path-data reader behind `pathFromD`.

It gives each command's letter as written and its numbers, reading an exponent's `e` as part of a number, `.5` and `1.5.5` as SVG reads them, and an arc's flags without a separator.

<!-- entry: api -->
