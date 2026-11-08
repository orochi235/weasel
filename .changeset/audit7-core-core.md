---
'@weasel-js/core': patch
---

Fixes from a second audit of core's scene, viewport, selection and geometry:

- `usePointerStylus` commits the last sample its throttle held back once the gap has passed, so a pen that comes to rest inside the gap no longer leaves the state on an older sample.
- `unionBounds` folds a box with a negative width or height by the span it covers, as `unionAABB` does.
- `sceneNodeClientRect` returns a positive rect at the box's screen top-left under a flipped (y-up) view.
- `RECT_POSE_DESCRIPTOR.lerp` (and `ROTATED_POSE_DESCRIPTOR.lerp`) interpolates `rotation` the short way round, as the descriptor's `axes` do; it carried the start angle through and jumped at the end.
- `AUTO_POSE_DESCRIPTOR` has a `lerp`, dispatching to the rect or Path descriptor, so `tweenPose` and `springPose` no longer throw on the default descriptor.
- `setLayerVisible`, `setLayerLocked`, `setLayerParallax` and `renameLayer` record no undo entry and leave the version alone when handed the value the layer already has.
