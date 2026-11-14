---
'@weasel-js/ui': minor
---

`CurveEditor` and `LayeredCurveEditor` take `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around either holds it.

A held plot passes no press, key, or context menu to its layers, so nothing drags, inserts, deletes, or steps, and undo and redo do nothing. Held for a reason, or read-only, it and its marks stay focusable and the plot describes why; disabled with no reason anywhere, the plot is `inert`. `CurveField` hands its own hold to its plot.

<!-- entry: api new -->
