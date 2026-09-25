---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

`ShapeKindIcon` draws the glyph for a shape kind — the one its insertion tool shows — and falls back to `UnknownIcon` for a kind the kit does not ship. The icon set gains `page` (`PageIcon`), a document page with a folded corner. Core now exports the `ShapeKind` type.
