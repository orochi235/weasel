---
'@weasel-js/ui': minor
---

`LayeredCurveEditor` takes `readOnlyPresses`, which lets presses and keys reach its layers while it is read-only, so a key or segment can still be selected.

Undo, redo, and the context menu stay refused, and the consumer refuses whatever edit a layer reports through `onChange`. Default `false`.

<!-- entry: api -->
