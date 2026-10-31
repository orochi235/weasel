---
'@weasel-js/font': patch
'@weasel-js/renderer': patch
---

Small atlas text keeps its weight and position as it moves between pixels. A glyph small enough for area
coverage now draws on a quad grown by `GLYPH_AREA_MARGIN` (one device pixel, new in `@weasel-js/font`) on
every side, and the shader reads the margin as empty rather than as the next glyph in the atlas. The quad
used to be the glyph's atlas cell, whose padding is narrower than the ink area coverage puts down past an
outline, so on a multisampled canvas the pixels its edges crossed were dimmed by the samples they missed:
a 7.2px Inter `H` swung 0.37px as it stepped through a pixel, and 0.10px now. `glyphCoverage` in
`GLYPH_COVERAGE_GLSL` takes a sixth argument, `cell`, which runs 0 to 1 across the grown quad; a program
pasting it in passes it, or a constant where its quads do not grow.
