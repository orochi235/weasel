---
'@weasel-js/diagram-formats': major
---

`documentFromScene` and `addDocumentScene` take a scene of `RectPose`, which is what they always read and wrote.

This is breaking for a caller whose scene has any other pose type: such a scene was read as rects regardless, so the type now says so. A rect-posed scene needs no change.

```ts
// before: compiled, and read every pose as a rect
documentFromScene(scene as Scene<Data, Layer, MyPose>);
// after: a RectPose scene, as before
documentFromScene(scene as Scene<Data, Layer, RectPose>);
```

<!-- entry: breaking api -->
