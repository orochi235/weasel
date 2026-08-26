---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

`LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
`primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
outline strokes at a fixed weight, and a grip is filled dots.

The grip's grab target is padded and the padding cancelled by an equal negative
margin, so it is comfortable to hit without drawing anything larger than the
dots or widening the row.

A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
medium's at 13px, which sat top-heavy against a small button's 12px icon and
20px box.
