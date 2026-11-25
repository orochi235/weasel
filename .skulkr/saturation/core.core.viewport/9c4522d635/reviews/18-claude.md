# Findings: core.core.viewport

## fitViewToBounds takes a FramedRect but silently ignores its `rotation` / `transform`
- where: packages/core/src/core/viewport/fitViewToBounds.ts:4,53 (fitViewToBounds; also `animateToBounds` in useViewAnimation.ts:191)
- scenario: `Bounds` is geom's `FramedRect`, which carries optional `rotation` and `transform`, so a node's rect pose type-checks as bounds. Passing a 45°-rotated 200×20 pose (e.g. `animateToBounds(node.pose, dims)` to zoom to a node) fits the unrotated 200×20 box: the fit is sized for a 20-unit-tall strip while the drawn node is ~156 units tall, so most of it lands off screen. It should either fit the frame's AABB (`poseFrameOf` the box and take the transformed corners' bounds) or the type should be a plain `Rect`, so the rotated pose doesn't type-check.
- evidence: read (FramedRect at packages/geom/src/poseFrame.ts:30 has `rotation?` / `transform?`; nothing in fitViewToBounds reads them)
- severity: medium

## sceneNodeClientRect's doc tells callers a rect pose "is its own AABB", which is false for a rotated or transformed pose
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:11-15,34 (SceneNodeClientRectOptions.getWorldBounds / sceneNodeClientRect)
- scenario: following the doc, a caller returns a rotated rect pose directly from `getWorldBounds`. `Bounds` (`FramedRect`) accepts it, and `sceneNodeClientRect` projects only x/y/width/height, so a `Callout` anchors to the unrotated box rather than the drawn node. This is the same dropped `rotation` / `transform` as in fitViewToBounds. Either the doc example has to require an unrotated pose, or the function has to take the frame into account.
- evidence: read
- severity: low

## useDecayLoop tracks the coast's position privately, so a view moved by anything else mid-coast is clamped against stale bounds
- where: packages/core/src/core/viewport/useDecayLoop.ts:94-123 (tick)
- scenario: `posX` / `posY` start at `initialPosition` and only advance by the loop's own `dx` / `dy`. The coast's caller (viewportDragPan.ts:157) applies each tick as `cur.x + dx` to the live view, so a wheel zoom, a keyboard pan or a `viewBounds` clamp on the canvas during the coast moves the real view while `posX` stays put. A `boundary: 'stop'` coast then stops (or `'bounce'` reflects) at the wrong place: it can carry the real view past `bounds.maxX` by however far the other write moved it, or halt short of the bound. The position should be read from the view each tick (or supplied via a getter), not accumulated separately.
- evidence: read
- severity: medium

## useDecayLoop teleports the view to the bound on the first frame when the coast starts outside `viewBounds`
- where: packages/core/src/core/viewport/useDecayLoop.ts:100-118 (tick)
- scenario: a drag that ends with the view past `maxX` (the drag itself isn't bounded by `inertia.bounds`) and flings further out with `boundary: 'stop'` or `'spring'` hits `newX > maxX` on the first frame. The loop then sets `dx = maxX - posX`, and the camera jumps the whole overshoot in one 16 ms frame instead of easing back. A fling *inward* from outside also snaps, because `newX` is still `> maxX`. It should either clamp only on crossing into out-of-bounds territory, or animate the return.
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
