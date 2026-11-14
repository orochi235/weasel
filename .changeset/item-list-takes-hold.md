---
'@weasel-js/ui': minor
---

`ItemList` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Held either way, Alt+arrow moves nothing and a row's `rowProps.onPointerDown`, where a `useReorderDragList` drag starts, is not called. Disabled, `onActivate` and `onSelectRange` are refused too, and with no reason anywhere the rows leave the tab order; read-only, rows still activate and extend. The rows' `trailing` controls are held with it.

<!-- entry: api new -->
