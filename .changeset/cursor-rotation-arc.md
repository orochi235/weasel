---
"@weasel-js/cursor": patch
"@weasel-js/core": patch
---

Rotatable cursors, and a `CursorSpec` for the four fields that declare one.

`bakeCursor` takes an `angle` in radians, quantized to 16 steps of 22.5°, and
turns both the glyph and its hotspot. `Tool.cursor`, `Action.cursor`,
`Action.activeCursor` and `AffordanceRegion.cursor` widen from `string` to
`CursorSpec` — either a CSS keyword, which passes through untouched, or
`{ glyph, size?, angle?, fallback? }`. Every cursor declaration written before
this keeps working.

Two glyphs ship with it. The selection's rotation ring now shows a real `rotate`
cursor instead of a bare `grab`, and the resize corners show a `resize` arrow
turned to the corner's actual axis — a rotated selection used to keep the
unrotated diagonal, because CSS has four diagonal keywords and a rotation needs
sixteen. The keyword remains as each spec's `fallback`.
