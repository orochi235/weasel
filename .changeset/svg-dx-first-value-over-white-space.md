---
'@weasel-js/svg': patch
---

`parseSvg` reads the first value of a `dx` or `x` list on text with white space SVG collapses, as it already did for `dy` and `y`, so a pretty-printed `<text dx="10">` keeps its shift.

<!-- entry: fix data -->
