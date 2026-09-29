---
"@weasel-js/core": patch
---

Nodes on a parallax scene layer can be edited where they are drawn, zooming planes included.

- Move, resize, rotate, clone, insert and path-anchor editing (drag, click, marquee, cut, insert anchor) pair the pointer with the node's pose in its plane's world: the kit's descriptors are wrapped by the new `inPlane(action, layerOf)` (with `selectionLayer`, `insertLayer` and `editingLayer`), which carries the drag, the trail, a click's `worldX` / `worldY`, a handle's pivot and the camera the action reads screen pixels through into the plane, converts the `nodeAtPoint` and `snap` deps at its boundary, and returns overlays in the camera's world. A custom editing action takes the same wrapper. `EditedLayerOf` receives the deps and the grabbed affordance. Nudge and align move a node in its own world's units, as they always have.
- Snapping on a plane compares like with like. Guides and the grid are the camera's, so `guideSnapStrategy` carries each guide line into the plane and `gridSnapStrategy` rounds the pose's origin on the camera's lattice and carries it back; `GestureContext.plane` (read from the new `ViewApi.plane`) is the map they use. A resize's point snaps (`pointSnapToGrid`) see their points in the camera's world.
- Path-edit chrome — the anchor and handle markers, the anchor marquee, the slops overlay — and the anchor hit-test read a plane node's path in the drawing camera's world. `createPathEditingOverlayLayer`'s `getPose` and `getMarquee` receive the drawing view; `anchorStateFrom` takes an optional path carrier.
- `InsertDep` gains an optional `layer()`, the layer `commit` puts a node on; the default dep reports its first layer.
- The preview ghost, and the selection box mid-gesture, follow a plane node through its plane.
- A second `<CanvasView>` boxes a plane node through its own camera: the surface's bounds resolver takes the asking view.
- A container's clip reaches a child on another plane in that child's world, in both painting and picking. New `planeToPlane` and `planeMatrix` helpers compose plane maps.
- `useSelectTool` takes `getView`, and `sceneToAdapter`'s `hitTestArea` / `hitTestLasso` take the asking view, so a bare adapter picks plane nodes too. `AreaSelectAdapter.hitTestArea` and `LassoSelectAdapter.hitTestLasso` accept that view (`RegionPickView`, which `HitTestView` now aliases).

Still open: a selection spanning planes that scale differently — see "Interactive parallax planes" in `docs/TODO.md`.
