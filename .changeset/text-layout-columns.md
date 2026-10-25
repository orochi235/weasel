---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

A text layout holds its code points in columns of numbers, and painting it reads them there, so text re-laid out every frame — a HUD readout — no longer leaves a cell, a placed glyph and a quad object per glyph for the garbage collector. A line's `cells` and `glyphs` and a group's `quads` read as before, built the first time something reads them. A `LaidOutGroup` gains `quadData`, its quads packed `QUAD_STRIDE` (exported) numbers each, which is what the renderer draws from, and a color group gains `colorGlyphs`.
