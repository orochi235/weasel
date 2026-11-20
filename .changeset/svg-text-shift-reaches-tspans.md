---
'@weasel-js/svg': patch
---

A `baseline-shift` on a `<text>` reaches each `<tspan>` in it that names none of its own. Subscript or superscript text with styled runs keeps its shift through an SVG round trip.

<!-- entry: fix visual -->
