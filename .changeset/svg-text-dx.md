---
'@weasel-js/svg': patch
---

SVG import reads a `dx` list on a `<text>` that holds only text, as it already read one on a `<tspan>`: each shift becomes letter spacing on the glyph before it, and a leading shift moves the text. A `dx` on a `<text>` holding a `<tspan>` still warns and is not read.
