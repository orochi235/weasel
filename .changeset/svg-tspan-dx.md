---
'@weasel-js/svg': patch
---

`parseSvg` reads a `<tspan dx>` list. Each glyph takes the shift of the glyph after it as letter spacing, on top of the spacing already in force, so text kerned by hand with `dx` (as Inkscape writes it) keeps its spacing, and the tspan comes back as one run per stretch of glyphs spaced alike. A leading shift lands on the glyph before the tspan, or moves the text's `x` when the tspan opens it. It used to warn and leave the glyphs at their own advance. Still unread, each with a warning: a `dx` on `<text>` itself, a leading shift that opens a later line, and a list on a tspan whose white space SVG would collapse.
