---
'@weasel-js/cursor': patch
---

A crosshair carrying a mark (`{ glyph: 'crosshair', mark: 'rect' }` and the rest) keeps its arms' white outline inside the cursor image, where its left and top ends were cut off.

<!-- entry: fix visual -->
