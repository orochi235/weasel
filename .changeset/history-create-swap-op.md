---
'@weasel-js/history': major
'@weasel-js/core': major
---

`swapOp` is `createSwapOp` in `@weasel-js/history` and core's re-export, spelled like the other op factories.

Prefs' own `swapOp` in `@weasel-js/prefs/edit` keeps its name.

```ts
// before
history.apply(swapOp({ name: 'rename', label: 'Rename', before, after, emit }));
// after
history.apply(createSwapOp({ name: 'rename', label: 'Rename', before, after, emit }));
```

<!-- entry: breaking api -->
