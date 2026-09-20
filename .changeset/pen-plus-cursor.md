---
'@weasel-js/cursor': patch
'@weasel-js/core': patch
---

Inserting a path anchor gets its own cursor. Alt over a segment in path-edit
mode drew the pen tool's own glyph, so the pointer said nothing about what the
click would do.

The new `penPlus` glyph is the pen nib with a filled plus badge in the
lower-right. The nib runs along the anti-diagonal and left no room on the
diagonal for a badge, so it is shifted two units up and left — the same trade
the shape cursors make with a short-armed crosshair. Proofed at 11x over the
three grounds and on the pixel grid at 16 and 24 CSS px, 1x and 2x.
