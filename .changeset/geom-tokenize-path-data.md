---
"@weasel-js/geom": patch
---

`tokenizePathData` is exported: the SVG path-data reader `pathFromD` uses, giving each command's letter as written and its numbers, an exponent's `e` read as part of a number, `.5` and `1.5.5` read as SVG reads them, and an arc's flags read without a separator.
