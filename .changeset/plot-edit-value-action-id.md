---
'@weasel-js/plot': major
---

Plot's value-dragging action has the id `plot.editValue`, as its "Edit value" label says, and the constant `EDIT_PLOT_VALUE_ACTION_ID`.

```ts
// before
const id = PLOT_DRAG_ACTION_ID; // 'plot.dragValue'
// after
const id = EDIT_PLOT_VALUE_ACTION_ID; // 'plot.editValue'
```

<!-- entry: breaking api -->
