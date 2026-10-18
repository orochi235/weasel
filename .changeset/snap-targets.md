---
'@weasel-js/core': patch
---

`<SceneCanvas toolOptions={{ snapTargets }}>` takes points to lock to that are
in no path, such as a measurement's ends (`nearestMeasureEnd`). They apply
wherever a path target does: the drawing tools take them ahead of `snapPoint`,
and a move and an anchor drag snap to them too, so moving a shape now snaps to
measurement ends. A path target in range still wins.

A move held by a target in range now stays on it rather than being moved off
again by the binding's own snapping behaviors, such as a grid.

Breaking: the `snap` dep's `toPaths` is renamed `toTargets`, since it answers
for both.
