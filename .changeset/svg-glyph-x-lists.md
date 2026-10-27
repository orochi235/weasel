---
'@weasel-js/svg': patch
---

svg import reads an `x` list that places each glyph of a `<tspan>`, or of a `<text>` holding only text, as letter spacing, where a loaded face measures the glyphs: kerned text exported with an `x` per glyph no longer imports run together. A `dx` list on the same element adds on top. With no face to measure them, or in right-to-left text, the list is still reported and only its first value read.
