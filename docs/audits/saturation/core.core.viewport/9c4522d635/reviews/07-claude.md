# Findings: core.core.viewport

## A coast released outside `viewBounds` teleports to the bound on its first frame, and a slow release stays outside
- where: packages/core/src/core/viewport/useDecayLoop.ts:100-118 (useDecayLoop tick), with packages/core/src/core/viewport/useDecayLoop.ts:146 (start)
- scenario: `viewport.dragPan` does not clamp the live drag to `inertia.bounds` (viewportDragPan.ts onMove writes `next` unclamped), so a drag can end with the view past `maxX`. It then hands `initialPosition: v.get()` to `start`. On the first moving frame `newX = posX + dx` is still `> maxX` whatever way the fling points, so `dx = maxX - posX`: the whole overshoot is applied in one frame, a visible jump instead of a coast. Under `'stop'` an inward fling (vx < 0 from outside `maxX`) also has `s.vx = 0` set, so its inward momentum is thrown away after the snap. If instead the release speed is under `minSpeed`, `start` returns at once and the view stays outside the bounds. So the same out-of-bounds release either snaps in a single frame or stays out, depending only on release speed. Expected: a position already outside the bounds is either left alone until the motion crosses back, or eased back in, the same way for fast and slow releases.
- evidence: read (tick branch logic; viewportDragPan.ts:131-161 for the unclamped drag and the `initialPosition` it passes)
- severity: medium

## `viewBounds` without `initialPosition` silently clamps against the origin
- where: packages/core/src/core/viewport/useDecayLoop.ts:150 (start)
- scenario: `DecayLoopOptions.initialPosition` is documented as "Required when `viewBounds` is set", but `start` does not enforce it and uses `posX/posY = 0`. A caller of the exported hook that passes `viewBounds: { minX: 500, maxX: 900 }, boundary: 'stop'` from a view at x = 700 gets a first frame where `0 + dx < 500`, so `dx = 500`: the view jumps 500 units and stops. Expected: a throw (or warning) on the missing field, like the `RangeError` `checkInertia` already raises for bad `friction` / `minSpeed`.
- evidence: read
- severity: low

## Under an unbounded clamp, a zoom whose product overflows lands at `ZOOM_FLOOR` instead of staying zoomed in
- where: packages/core/src/core/viewport/zoomAt.ts:17 (clampScale); also packages/core/src/core/viewport/fitSize.ts:30 (fitZoom)
- scenario: unruled.md (2026-11-19) tells a caller wanting the raw ratio to pass `{ min: 0, max: Infinity }`. With that clamp, `Math.abs(scale * factor)` that overflows to `Infinity` passes `Math.min(Infinity, …)` as `Infinity`, and `normalizeZoom(Infinity)` returns `ZOOM_FLOOR` (1e-9). So `zoomAt({x:0,y:0,scale:{x:1e10,y:1e10}}, a, 1e300, { max: Infinity })` jumps to the opposite extreme of zoom instead of holding the largest finite scale or leaving the view unchanged. `fitZoom` has the same path when `availW / contentW` overflows for subnormal content under `max: Infinity`.
- evidence: read (normalizeZoom in packages/geom/src/view.ts:32 maps ±Infinity to the floor)
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
