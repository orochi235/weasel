---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A measurement reads its true length inside a magnified frame. Each end records the frame it lands in, the topmost node declaring a unit scope whose drawn box holds it, as `frames` beside its `start` and `end` in `MeasureData.measure` and on `Measurement`. `MeasureReadout` divides the distance and the offsets by `measureMagnification(scene, frames)`, so a measurement inside a drawer drawn at 0.4× reads the drawer's lengths, not world's. Ends in frames declaring different scopes read in the scope chain the frames share, world when they share none. A measurement saved without `frames` reads in world as before.

`unitFrameAt(scene)` gives the frame a world point lands in. `sceneMagnification` and `sceneSharedUnitScopes` take `{ inclusive: true }` to count each given node's own scope. `measureBetween` and `measureNode` take the frames as an optional last argument.
