---
'@weasel-js/cursor': patch
---

`resolveCursor` throws for an unknown glyph, or a mark on a glyph with no slot, when the spec resolves to a painted cursor too.

<!-- entry: fix -->
