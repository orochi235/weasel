# Findings: core.core.viewport (blind reviewer)

## A coast that starts outside `viewBounds` teleports to the wall in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:104 (useDecayLoop tick, all three boundary branches)
- scenario: `viewportDragPan` passes `inertia.bounds` as `viewBounds` and the live view as `initialPosition`, but the drag itself never clamps to `inertia.bounds`. Drag past `minX: 0` to `x = -50` and release with `vx = -1` (or even `+0.5`, heading back in). First moving frame: `newX = -50 + v·dt < 0`, so `dx = minX - posX = +50` — the camera jumps 50 world units in one frame (and under `'stop'` loses its x velocity). Expected: a coast that starts outside the limits either eases back or is clamped at start, never a one-frame jump of arbitrary size. The same holds when `inertia.bounds` changes between press and release, or a canvas resize leaves the view outside them.
- evidence: read (useDecayLoop.ts tick; viewportDragPan.ts:149-160 shows no clamp of the drag to `inertia.bounds`)
- severity: medium

## `normalizeView` turns a `-Infinity` scale axis into a positive one, flipping a y-up camera
- where: packages/core/src/core/viewport/view.ts:65 (normalizeAxis)
- scenario: `normalizeView({ x: 0, y: 0, scale: { x: 1, y: -Infinity } })` — `s < 0 && s > -Infinity` is false, so it takes `normalizeZoom(-Infinity)`, which is `+ZOOM_FLOOR`. The y-up camera comes back y-down. The `View` doc and `normalizeView`'s own doc say "a negative one keeps its sign"; a `-Infinity` (e.g. a y-up view scaled by an overflowing zoom factor upstream, or `-1/0` from a degenerate fit) should come back `-ZOOM_FLOOR`.
- evidence: read (geom `normalizeZoom`: `zoom >= ZOOM_FLOOR && zoom < Infinity ? zoom : ZOOM_FLOOR`)
- severity: low

## A parallax `zoom` factor above 1 collapses the plane to `ZOOM_FLOOR` once the camera zooms out
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `deriveParallaxView({x:0,y:0,scale:{x:0.5,y:0.5}}, { pan: 1, zoom: 2 })` → magnitude `track(1, 0.5, 2) = 1·(−1) + 0.5·2 = 0`, then `normalizeZoom(0) = ZOOM_FLOOR`; at camera scale 0.4 it is −0.2, also the floor. The plane snaps to the minimum zoom (content vanishes to a point) instead of continuing to exaggerate the zoom. `pan` documents >1 as "leads"; the same over-1 factor on `zoom` is accepted unchecked and the linear blend crosses zero. A geometric blend (`|outer|^factor`) would stay positive for every factor; alternatively the option should reject values that can cross zero.
- evidence: read
- severity: low

## `useDecayLoop` drops the superseded coast's `onEnd` on restart, cancel and unmount
- where: packages/core/src/core/viewport/useDecayLoop.ts:136 (cancel, called from start and the unmount effect)
- scenario: start a coast with `onEnd` that clears a "coasting" flag (or commits/records the coast's end); a second fling calls `start`, which calls `cancel()` and nulls `stateRef` without calling the first config's `onEnd`. Same on unmount. Meanwhile a coast below `minSpeed` at start *does* call `onEnd` at once, so `onEnd` means "the coast is over" on one path and is silently skipped on the others. A caller pairing a begin with `onEnd` leaks the begin.
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
