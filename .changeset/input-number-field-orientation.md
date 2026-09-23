---
'@weasel-js/ui': patch
---

`Input` and `NumberField` take `orientation`, the same `'stacked' | 'row'` that `Field` and `Select` take. `'row'` sets the label beside the field at its own width, the field takes the rest of the row, and any description or error drops to a line of its own; a `NumberField` with `width="fit"` keeps its own width and centers on the label. The default, `'stacked'`, renders as before.
