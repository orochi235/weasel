---
"@weasel-js/core": patch
"@weasel-js/font": patch
---

Text no longer breaks a batched run. Glyphs, the rules under underlined words,
and tessellated glyph outlines all stage into the same draw as the solid
geometry and image quads around them, so a wall of captioned thumbnails is one
draw where every label used to cost two.

The batch shader carries the glyph math behind a per-vertex paint mode. It runs
that math on every fragment, glyph or not, because `fwidth` in non-uniform
control flow is undefined and the derivative has to be taken before anything
selects on the mode — priced at about 1.4% of a fragment that is not a glyph.
The vertex is what grows: it gains the paint mode and the synthetic-bold
threshold, which is what lets a bold word, a regular one, a baked MSDF atlas and
a runtime canvas bake share a draw. A synthetic oblique now shears on the CPU as
the batch places its corners, rather than in a vertex shader that read the
baseline from a vertex attribute.

Two rules a run used to break on are gone with it: a second text color in the
same paragraph, and a decoration whose fill differs from the glyphs it sits
under. Both ride the vertices now.

**Breaking for anyone importing the text shader sources.** `TEXT_VERT_SRC`,
`TEXT_FRAG_SRC`, `TEXT_FRAG_R8_SRC`, `TEXT_SDF_UNIFORMS` and
`TEXT_SDF_ATTRIBUTES` are removed from `@weasel-js/font`: text has no program of
its own any more. What replaces them is `GLYPH_COVERAGE_GLSL`, the snippet a
program pastes in to turn an atlas sample into coverage, alongside
`GLYPH_MODE_MSDF` and `GLYPH_MODE_R8` naming the two channel layouts.
