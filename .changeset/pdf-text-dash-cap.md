---
"@weasel-js/pdf": patch
---

A text stroke whose dash is too fine for its glyphs is written solid, as the renderer draws it. The
dash's run count is now measured against the glyph outlines' total length, as a path stroke's is.
