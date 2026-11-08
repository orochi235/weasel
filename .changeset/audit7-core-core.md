---
'@weasel-js/core': patch
'@weasel-js/editor': patch
'@weasel-js/diagram': patch
---

Fixes from a second audit of core's scene, viewport, selection and geometry:

- `usePointerStylus` commits the last sample its throttle held back once the gap has passed, so a pen that comes to rest inside the gap no longer leaves the state on an older sample.
- `unionBounds` folds a box with a negative width or height by the span it covers, as `unionAABB` does.
- `sceneNodeClientRect` returns a positive rect at the box's screen top-left under a flipped (y-up) view.
- `RECT_POSE_DESCRIPTOR.lerp` (and `ROTATED_POSE_DESCRIPTOR.lerp`) interpolates `rotation` the short way round, as the descriptor's `axes` do; it carried the start angle through and jumped at the end.
- `AUTO_POSE_DESCRIPTOR` has a `lerp`, dispatching to the rect or Path descriptor, so `tweenPose` and `springPose` no longer throw on the default descriptor.
- `setLayerVisible`, `setLayerLocked`, `setLayerParallax` and `renameLayer` record no undo entry and leave the version alone when handed the value the layer already has.
- A fit with nothing to fit lands on the view Cmd-0 gives. `HOME_VIEW` and `resetView` define that view once: the canvas's `viewport.recenter`, else `HOME_VIEW`, the world origin at 100%. `fitViewToBounds`, `fitViewToPage`, `fitZoom`, `fitToBounds` and `computeFitViewport` now return `null` for content with no extent on either axis (`hasExtent`), with no warning and no fall to `ZOOM_FLOOR`; `fitViewToBounds` no longer hands back the current view for it. This is a breaking change to those return types. `viewport.zoom`'s Fit Content, the off-page follow and the editor's page fits resolve `null` to the reset view, `useAutoCenter` waits for content before it centers, and `ViewAnimationApi.animateToBounds` returns `false` without moving. `fitViewToBounds` fits a lone line along the axis it has; Fit Content no longer centers a lone point at the current zoom, and goes to the reset view instead.
- `scene.update` and `scene.setPose` record no undo entry, leave the version alone and notify no one when handed the data or pose the node already has, compared by structure as the declared-field setters compare. A drag whose pointer holds still for a frame still lands as one undo entry.
