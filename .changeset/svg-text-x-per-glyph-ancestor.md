---
'@weasel-js/svg': patch
---

SVG import now reads a `<text>`'s per-glyph `x` list through a `<tspan>` that has its own `x` or `dx`. Each glyph takes its value from its own `<tspan>` where that list has one, and from the `<text>` otherwise, as SVG does. Before, such a list was reported and only its first value read. A `<tspan>` it reaches that opens a new line with an `x` and a `y` or `dy` starts a new measurement, so the list is read on every line it spans. Like every `x` list, it is read only where a loaded face measures the glyphs.
