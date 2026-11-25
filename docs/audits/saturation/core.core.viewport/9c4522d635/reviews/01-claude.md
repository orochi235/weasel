## A parallax plane with `zoom` above 1 collapses to the zoom floor once the camera zooms out far enough
- where: packages/core/src/core/viewport/parallax.ts:54 (trackZoom)
- scenario: `deriveParallaxView({ x: 0, y: 0, scale: { x: 0.4, y: 0.4 } }, { pan: 1, zoom: 2 })`. The magnitude is `track(1, 0.4, 2) = 1 - 2 + 0.8 = -0.2`, and `normalizeZoom(-0.2)` returns `ZOOM_FLOOR` (1e-9), so the plane is drawn at 1e-9 scale and disappears. `planeMap` then gives `kx = 0.4 / 1e-9`, so a pointer mapped into the plane lands at about 4e8 times its position. At 0.5 the magnitude is exactly 0, so the plane collapses at that zoom too. The scale is tracked linearly, so any factor `f > 1` passes through zero at camera zoom `1 - 1/f`. `pan` is documented to accept values above 1 ("leads"), and nothing rejects `zoom` above 1. The scale should keep growing past the camera's (for example `|outer|^f`), or a `zoom` above 1 should throw.
- evidence: read (traced the arithmetic against normalizeZoom in packages/geom/src/view.ts:32)
- severity: medium

## sceneNodeClientRect's doc says a rect pose can be returned as its own AABB, which drops its rotation and transform
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:11-15, 34-36 (sceneNodeClientRect)
- scenario: The doc says "for rect poses the pose is its own AABB and can be returned directly", and `Bounds` is `FramedRect`, which accepts `rotation` and `transform`, so the type checker allows it. A node rotated 45° gets passed straight through. Only `x`, `y`, `width` and `height` are projected, so a `Callout` anchors to the unrotated box rather than the drawn shape's bounds. A long thin bar shows this most clearly: its anchor rect is off by about half its length. The function should take the AABB of the framed rect (through its rotation and transform), or the doc should require an axis-aligned box and the parameter type should rule out rotation.
- evidence: read
- severity: medium

## fitSize and fitViewToBounds handle a zero-area viewport differently
- where: packages/core/src/core/viewport/fitSize.ts:49-50 (fitSize)
- scenario: `fitViewToBounds` given a viewport of 0 or less warns and returns `currentView` unchanged. `fitSize(0, 0, 100, 100)` instead fits the content into a 1px box (`Math.max(1, …)`) and returns zoom 0.1 (the min clamp) with pan -5. A caller using `fitSize` before the first measurement gets zoomed all the way out, where `fitViewToBounds` would leave the view alone. `useFitOnce` guards against this on its own; other callers of `fitSize` and `fitZoom` do not. One rule for an unfittable viewport should serve both, as `hasExtent` already does for empty content.
- evidence: read
- severity: low

## A decay that starts past a bound with boundary set jumps to the bound in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:101-117 (tick)
- scenario: Take `initialPosition.x = -50`, `viewBounds.minX = 0`, `boundary: 'spring'` and `velocity.vx = 0.5`: a fling back toward the bounds after an overscroll drag. On the first real frame `newX` is about -42, which is still below `minX`, so `dx = minX - posX = 50`. The view jumps 50 units in one tick, and `vx` is also halved as if it had bounced. 'stop' and 'bounce' make the same jump. The clamp only checks whether the new position is past the bound, not whether the motion crosses it, so a decay that starts outside the bounds is pulled in at once instead of coasting back.
- evidence: read
- severity: low

## Files read
packages/core/src/core/viewport/checkInertia.ts
packages/core/src/core/viewport/clampView.ts
packages/core/src/core/viewport/clientToWorld.ts
packages/core/src/core/viewport/createVelocityTracker.ts
packages/core/src/core/viewport/fitSize.ts
packages/core/src/core/viewport/fitViewToBounds.ts
packages/core/src/core/viewport/homeView.ts
packages/core/src/core/viewport/interpolateView.ts
packages/core/src/core/viewport/parallax.ts
packages/core/src/core/viewport/sceneNodeClientRect.ts
packages/core/src/core/viewport/screenSlop.ts
packages/core/src/core/viewport/useCanvasSize.ts
packages/core/src/core/viewport/useDecayLoop.ts
packages/core/src/core/viewport/useFitOnce.ts
packages/core/src/core/viewport/useNodeOverlayFrame.ts
packages/core/src/core/viewport/useVelocityTracker.ts
packages/core/src/core/viewport/useViewAnimation.ts
packages/core/src/core/viewport/view.ts
packages/core/src/core/viewport/viewTransform.ts
packages/core/src/core/viewport/viewportWorldRect.ts
packages/core/src/core/viewport/wheelHandler.ts
packages/core/src/core/viewport/zoomAt.ts
packages/core/src/core/viewport/zoomBounds.ts

<!-- done: 4 findings, files read: 23 -->
