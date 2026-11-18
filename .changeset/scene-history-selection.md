---
'@weasel-js/core': major
---

`sceneSelectionStore` is `sceneHistorySelection`: it adapts a scene to the `HistorySelection` `createHistory` takes.

```ts
// before
createHistory({ selection: sceneSelectionStore(scene) });
// after
createHistory({ selection: sceneHistorySelection(scene) });
```

<!-- entry: breaking api -->
