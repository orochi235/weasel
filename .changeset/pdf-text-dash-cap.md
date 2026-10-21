---
"@weasel-js/pdf": patch
---

A text stroke whose dash is too fine for its glyphs is written solid, as the renderer draws it. The
dash's run count is measured against the segment's longest glyph outline, since the renderer
strokes each glyph on its own.
