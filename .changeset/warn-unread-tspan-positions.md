---
'@weasel-js/svg': patch
---

SVG import warns about glyph positioning it does not read: a list-valued `x` or `y` on a `<tspan>` (as it already did on `<text>`), and a nonzero `dx` or `rotate` on either.
