---
'@weasel-js/plot': major
---

`plotEditing` is `createPlotEditingContribution`, spelled like the other contribution factories.

```ts
// before
const editing = useMemo(() => plotEditing({ scene }), [scene]);
// after
const editing = useMemo(() => createPlotEditingContribution({ scene }), [scene]);
```

<!-- entry: breaking api -->
