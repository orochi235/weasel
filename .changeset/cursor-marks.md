---
'@weasel-js/cursor': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Set a mark in a cursor's corner instead of drawing one glyph per pair

- A cursor glyph with a mark slot carries a mark naming what the tool does: `cursorFor('crosshair', { mark: 'rect' })`, or `{ glyph: 'pen', mark: 'add' }` as a `CursorSpec`. The mark is drawn after the glyph with a halo of its own, in both the baked and the painted tier.
- `crosshair` and `pen` have slots. The marks are `add`, `remove`, `rect`, `ellipse`, `polygon`, `star` and `line`, in `MARKS`.
- Breaking for `@weasel-js/cursor`: `crosshairRect`, `crosshairEllipse`, `crosshairLine`, `crosshairStar`, `crosshairPolygon` and `penPlus` are gone from `GLYPHS`. Write `cursorFor('crosshair', { mark: 'rect' })` and the like, and `{ glyph: 'pen', mark: 'add' }` for `penPlus`. Each pair bakes to the same pixels and hotspot the glyph it replaces did.
- New exports: `cursorGlyph(name, mark?)`, `markedGlyph`, `placeCursorPath`, `cursorVariants()`, `MARKS`, and the types `CursorMark`, `CursorMarkSlot`, `CursorMarkName`, `CursorVariant` and `CursorForOptions`.
