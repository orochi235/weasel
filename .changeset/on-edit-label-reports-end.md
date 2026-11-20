---
'@weasel-js/diagram': minor
---

`DiagramView`'s `onEditLabel` hears which end label a double-click landed on, as a second `end` argument.

`createEditEdgeLabelAction`'s `commit` is handed the pressed label's id as a third argument, and the new `labelEndOf(edgeId, labelId)` reads it as `'from'`, `'to'` or `null`.

```tsx
<DiagramView onEditLabel={(edge, end) => (end ? editEndLabel(edge, end) : editLabel(edge))} />
```

<!-- entry: api fix -->
