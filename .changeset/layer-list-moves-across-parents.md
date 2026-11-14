---
'@weasel-js/ui': minor
---

`LayerList` drops a layer into another layer, and Alt+Left/Right move one out of its parent or in; `canMove` can refuse a move.

A `LayerMove`'s `parentId` is where the layers land, which can be another parent than the one they left, and `moveLayers` applies such a move. A drop into a locked layer is refused, and so is one past a fixed row, which used to land on the row's near side. `useSceneLayerList` reparents the nodes such a move carries and returns a `canMove` that keeps a note within its own annotation layer's row.

<!-- entry: rank=10 new api behavior -->
