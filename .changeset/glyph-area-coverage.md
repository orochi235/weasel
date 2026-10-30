---
'@weasel-js/font': patch
'@weasel-js/renderer': patch
---

Small atlas text keeps its ink where it moves. Where a pixel spans more than `GLYPH_AREA_FROM` (0.2) field
units, about 30px an em on a runtime canvas page and 40 on Inter's baked atlas, `glyphCoverage` blends
toward the mean of four field taps on a rotated grid, a box filter over the pixel, and takes nothing else
from `GLYPH_AREA_FULL` (0.3) up. A stem narrower than a pixel no longer inks by where it sits, so a 16px
`H`'s ink centroid stays within 0.04px of its position at every sub-pixel offset, where it swung by 0.66px.

The taps cost nothing elsewhere: only a run holding glyphs that small draws with a build of the batch program
that has them, and every other run's fragments cost what they did before (`fill-rate`'s `batch` and
`batch-glyph-large`, teitou). A fragment taking the taps costs about 2.2 times a plain one.
`GLYPH_POINT_COVERAGE_GLSL` is the coverage without them, and `glyphNeedsArea` says which a caller staging
glyphs needs.

This changes `GLYPH_COVERAGE_GLSL`'s contract: a program pasting it in must first define
`vec4 glyphTap(vec2 uv)`, returning the atlas sample at `uv` through `textureLod` at level 0, because the
taps run inside a branch where `texture()` would take its level from an undefined derivative.
