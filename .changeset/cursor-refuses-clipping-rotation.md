---
'@weasel-js/cursor': patch
---

`bakeCursor`, `cursorFor` and `resolveCursor` throw a `RangeError` for an angle that would turn part of a glyph out of its box, such as a crosshair carrying a mark, instead of baking it clipped.

<!-- entry: fix -->
