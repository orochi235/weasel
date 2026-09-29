---
"@weasel-js/core": patch
---

Nodes on a parallax scene layer can be edited where they are drawn, zooming planes included.

- Move, resize, rotate, clone and insert pair the pointer with the node's pose in its plane's world: the kit's descriptors are wrapped by the new `inPlane(action, layerOf)` (with `selectionLayer` and `insertLayer`), which carries the drag, the trail, a handle's pivot and the camera the action reads screen pixels through into the plane, converts the `nodeAtPoint` and `snap` deps at its boundary, and returns overlays in the camera's world. A custom editing action takes the same wrapper. Move behaviors such as `snapToGrid` run in the plane's world; nudge and align move a node in its own world's units, as they always have.
- `InsertDep` gains an optional `layer()`, the layer `commit` puts a node on; the default dep reports its first layer.
- The preview ghost, and the selection box mid-gesture, follow a plane node through its plane.
- A second `<CanvasView>` boxes a plane node through its own camera: the surface's bounds resolver takes the asking view.
- A container's clip reaches a child on another plane in that child's world, in both painting and picking. New `planeToPlane` and `planeMatrix` helpers compose plane maps.
- `useSelectTool` takes `getView`, and `sceneToAdapter`'s `hitTestArea` / `hitTestLasso` take the asking view, so a bare adapter picks plane nodes too. `AreaSelectAdapter.hitTestArea` and `LassoSelectAdapter.hitTestLasso` accept that view (`RegionPickView`, which `HitTestView` now aliases).

Still open: a selection spanning planes that scale differently, snapping against guides the camera draws, and anchor editing on a plane — see "Interactive parallax planes" in `docs/TODO.md`.
