---
'@weasel-js/ui': patch
---

`GradientHandles` and `MeshHandles` take an optional `onCancel`, called when a handle drag is abandoned, after the last `onInput` has put the value back where the drag began. This is additive: an owner that opens an edit on `onInput` now has a place to end it without keeping it. `SceneGradientHandles` uses it to cancel its `setFill` / `setStroke` action, which a canceled drag used to leave open and commit later, on unmount or a slot change.
