---
'@weasel-js/renderer': patch
---

Fix glyphs drawn as black-and-white wedges where a rect clip crosses them, such as the descenders at the bottom of a sticky note with `overflow: 'clip'`. Small text's glyph quads are grown for area coverage and carry each vertex's corner in `a_post`, and cutting such a quad interpolated that corner into one that names the wrong corner. A grown glyph that a clip crosses is now drawn uncut through the stencil.
