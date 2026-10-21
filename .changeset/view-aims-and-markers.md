---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

Views answer what they show: `SceneCanvasApi.aimOf` and `setAim`, and `<CanvasView aim onAimChange>` for a view that holds its aim and derives its camera from it. `<ViewMarker>`, or a contribution's `markers`, draws one view's aim inside another's frame, and dragging the marker moves that view; `actions={null}` turns marker dragging off. kernel3d answers a frustum aim with `aimOf3d`.

`CanvasViewProps` is now a union: `aim` cannot be passed together with `view`, `defaultView`, `onViewChange` or `viewBounds`. Code that writes an interface extending `CanvasViewProps` needs a type alias instead.
