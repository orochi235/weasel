---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
---

Laying out and drawing text that changes every frame makes about 40% less garbage: 6.0 MB a frame against 9.7 for 5,000 glyphs of HUD readout. `paintRuns` no longer builds a group key string for a glyph keyed like the one before it, `lineDecorations` no longer builds a paint key for undecorated text, `measureRuns` makes one entry object a code point instead of two, and the renderer passes each glyph quad to its batch as an object rather than as fifteen numbers V8 had to box.
