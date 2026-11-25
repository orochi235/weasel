# Findings: core.core.viewport

## sceneNodeClientRect projects a rotated or transformed box as if it were unrotated
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:33 (sceneNodeClientRect)
- scenario: `getWorldBounds` is typed `Bounds` (geom's `FramedRect`, which carries optional `rotation` and `transform`), and the option's doc says "for rect poses the pose is its own AABB and can be returned directly". A `RectPose` with `rotation: Math.PI / 4` handed back as advised is projected from only `x, y, width, height`, so the `Callout` anchors to the unrotated box: a 100×10 bar rotated 90° reports a 100-wide, 10-tall client rect where the node covers a 10-wide, 100-tall area. Expected: the AABB of the framed box (via `poseFrameOf`), or the doc should not call a rect pose its own AABB, and the type should not accept a frame it drops.
- evidence: read (RectPose has `rotation`/`transform`, packages/core/src/core/geometry/rectPose.ts:13; FramedRect, packages/geom/src/poseFrame.ts:30)
- severity: medium

## fitViewToBounds accepts a framed rect and silently drops its rotation and transform
- where: packages/core/src/core/viewport/fitViewToBounds.ts:49 (fitViewToBounds)
- scenario: `Bounds` is `FramedRect`, so a caller can pass a node's composed `RectPose` with `rotation` (or a `transform` that scales it). The fit reads only `x, y, width, height`, so a rotated node gets framed by its unrotated box: a 400×20 bar rotated 90° is fit at its 400px width and overflows the viewport vertically. Expected: fit the framed box's AABB, or a type without the frame fields. The same rule as the sceneNodeClientRect finding, answered the same wrong way in a second place.
- evidence: read
- severity: low

## useDecayLoop treats a missing initialPosition as the origin when viewBounds is set
- where: packages/core/src/core/viewport/useDecayLoop.ts:147 (start)
- scenario: `DecayLoopOptions.initialPosition` is documented as "Required when `viewBounds` is set", but `start({ velocity, viewBounds: { minX: 500 }, boundary: 'stop', onTick })` with no `initialPosition` runs with `posX = 0`. The first tick sees `0 + dx < 500`, emits `dx = 500 - 0` (a 500-unit jump in one frame) and zeroes `vx`, although the real view may already sit far inside the bounds. Expected: throw or warn on the documented misuse, as `checkInertia` does for bad friction, rather than clamping against a position the view is not at.
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

<!-- done: 3 findings, files read: 23 -->
