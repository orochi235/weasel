---
'@weasel-js/ui-logic': minor
'@weasel-js/ui': minor
---

A measured row list sizes its empty state in italic, as `ItemList` draws it, so the measured box matches the DOM one.

`FontSpec` takes `style` (`'normal'` or `'italic'`), which `createDomMeasureEnv` measures in, and `RowListMetrics` gives the `emptyFont` the empty state is measured in.

<!-- entry: fix api -->
