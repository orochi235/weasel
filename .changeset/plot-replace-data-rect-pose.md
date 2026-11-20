---
'@weasel-js/plot': major
---

`replacePlotData` takes a scene of `RectPose`s, the pose a plot root has, instead of claiming any pose type.

This is a breaking change for a caller whose scene names another pose type; it was read as a `RectPose` all along. A scene typed `Scene<TData, TLayer, RectPose>` needs no change.

```ts
replacePlotData(scene as Scene<MyData, MyLayer, RectPose>, rootId, data);
```

<!-- entry: breaking api -->
