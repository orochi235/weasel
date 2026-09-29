---
"@weasel-js/core": patch
"@weasel-js/font": patch
---

Small atlas text no longer loses stems narrower than a pixel. The shader used
to size its antialiasing band from the derivative of the distance field. That
derivative reads flat when a 2x2 pixel quad straddles a thin stem, so the band
collapsed and the stem disappeared. A 12px superscript `H` in Inter rendered at
DPR 1 without its left stem. The band now comes from the screen derivatives of
the texture coordinate, scaled by each atlas's page size and field range.

Additive: `glyphFieldScale(source, family, weight, style)` is exported from
`@weasel-js/font`, and `BmFont` gains an optional `distanceRange` read from
msdf-bmfont-xml's `distanceField.distanceRange`. `GLYPH_COVERAGE_GLSL`'s
`glyphCoverage` now takes two more arguments, `uv` and `fieldPerUv`. That breaks
any custom program that pastes the snippet in and calls it.
