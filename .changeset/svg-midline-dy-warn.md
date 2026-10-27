---
'@weasel-js/svg': patch
---

SVG import reports a vertical move it does not read: a `dy` list moving any glyph after the first, and a `<tspan>` that moves its glyphs up or down by `dy` or a new `y` without an `x` to start a new line. Both used to be dropped without a word.
