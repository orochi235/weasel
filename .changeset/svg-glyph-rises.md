---
'@weasel-js/svg': patch
---

SVG import reads glyphs moved up or down off their line: a `dy` or `y` list on a `<text>` or `<tspan>`, and a `<tspan>` moved by `dy` or `y` without an `x`. Each stretch of glyphs at one height becomes a run raised or lowered by `baselineShift`, on top of any `baseline-shift` it already had, and the move carries on to the text after it until a new line or another move, as SVG places it. These used to be reported and dropped. A new line's pitch is now measured from the last line's baseline rather than from wherever the last glyph sat, and a `<tspan>` with an `x` that lands back on its line's baseline stays on that line.
