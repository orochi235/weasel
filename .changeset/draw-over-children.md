---
'@weasel-js/core': patch
---

A painter can draw over a container's children. `overChildren(commands)` wraps part of what a `drawOne` returns, and the scene walk (`buildSceneTree`, so `<SceneCanvas>` and `buildSceneViewCommands` alike) paints that part after the node's children, in the node's own layer, with the node's rotation, alpha, and clips. `defaultDrawOne` uses it for a container's `data.label`, which the container's children used to cover: a group made by Outline Stroke from a labeled rect shows its label again. Additive: `overChildren`, `isOverChildren`, and `splitOverChildren` are new exports, and outside a scene walk the wrapped part is an ordinary group painted where it sits.
