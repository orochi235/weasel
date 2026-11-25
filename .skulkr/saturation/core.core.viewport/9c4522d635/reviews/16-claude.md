## A parallax `zoom` factor above 1 collapses the plane to ZOOM_FLOOR once the camera zooms out
- where: packages/core/src/core/viewport/parallax.ts:57 (trackZoom)
- scenario: `deriveParallaxView({x:0,y:0,scale:{x:0.3,y:0.3}}, { pan: 1, zoom: 1.5 })` — a "leading" plane, which the doc offers for `pan` (>1 = leads) and `zoom` shares the same "fraction" wording. `track(1, 0.3, 1.5) = 1*(-0.5) + 0.45 = -0.05`, so `normalizeZoom(-0.05)` returns the floor and the plane is drawn at ~0 scale; `planeMap`'s `kx = outer/inner` then blows up, so picking through the plane maps every point far away. Any zoom factor f > 1 hits this at camera magnitudes below 1 − 1/f. The magnitude is interpolated linearly, so it crosses zero; tracking it geometrically (`|outer|^factor`) or clamping the factor would keep it positive.
- evidence: read
- severity: medium

## A decay that starts outside its bounds teleports to the edge in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:103-122 (tick)
- scenario: a pan dragged past its limits (rubber-band overscroll) is released with `boundary: 'spring'` or `'bounce'`, `initialPosition.x = minX - 200`, and velocity pointing back toward the inside. On the first frame `newX < minX` is still true, so `dx = minX - posX` moves the view 200 units in one frame instead of letting it coast or spring back. Under `'stop'` the same check also zeroes `vx` although the motion is heading inward. The test should only fire when the step crosses the edge going outward (`posX >= minX && newX < minX`), or a start outside the bounds should be handled on its own.
- evidence: read
- severity: medium

## `viewBounds` without `initialPosition` clamps against position 0, silently
- where: packages/core/src/core/viewport/useDecayLoop.ts:144 (start)
- scenario: `start({ velocity, viewBounds: { minX: 100, maxX: 500 }, boundary: 'stop', onTick })`, where the view sits at x = 300. The doc says `initialPosition` is "Required when `viewBounds` is set", but `start` defaults it to `{0, 0}`. The first tick sees `newX < 100` and jumps the view by +100 with zero velocity, instead of coasting from 300. `start` already throws on bad `friction`/`minSpeed` through `checkInertia`; it does not check for this missing required field.
- evidence: read
- severity: low

## `fitSize` accepts a `fill` outside (0, 1] and quietly returns the minimum zoom
- where: packages/core/src/core/viewport/fitSize.ts:49-50 (fitSize)
- scenario: `fitSize(800, 600, 100, 100, 0, undefined, 0)` (or a negative or NaN `fill`). `availW` becomes 0, negative or NaN, so `raw` is ≤ 0 or NaN. A ≤ 0 raw clamps to `DEFAULT_MIN_ZOOM`, and a NaN one goes through `Math.max(min, NaN)` = NaN into `normalizeZoom`. The caller gets a 10% (or floor) zoom with no error. The sibling inertia options throw a `RangeError` on out-of-range input (`checkInertia`); this one doesn't.
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
