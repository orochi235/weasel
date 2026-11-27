---
'@weasel-js/ui': minor
---

`LayeredCurveEditor` takes `readOnlyPresses`, so a read-only plot still lets presses and keys reach its layers to select.

Undo, redo, and the context menu stay refused, and the consumer refuses whatever edit a layer reports through `onChange`. Default `false`.

<!-- entry: api -->
