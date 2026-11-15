---
'@weasel-js/ui': minor
---

`GradientEditor`, `BandEditor`, `Timeline` and `CurveField` take `onCancel`, and Escape cancels a drag in them and in `GradientHandles` and `MeshHandles`.

A canceled drag first sends `onInput` the value it began from. `GradientHandles` and `MeshHandles` draw a commit-only caller's drag themselves.

<!-- entry: api new -->
