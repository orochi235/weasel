---
'@weasel-js/ui': major
---

Alt-clicking a `LayerList` row's visibility checkbox or lock shows or locks that layer alone.

A second Alt-click turns every layer back on. A layer shown alone keeps its containers shown and the layers inside it as they were. So that an Alt-click is one undo step, `onVisibilityChange` and `onLockChange` now receive every row that changes, keyed by id; `useSceneLayerList` commits them as one history entry.

```ts
// before
onVisibilityChange={(id, visible) => setShown(id, visible)}
// after
onVisibilityChange={(changes) => { for (const [id, visible] of Object.entries(changes)) setShown(id, visible); }}
```

<!-- entry: rank=10 breaking new api -->
