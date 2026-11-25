# Findings: core.core.viewport

## A coast that starts outside `viewBounds` snaps to the bound on its first moving frame, even when it is heading inward
- where: packages/core/src/core/viewport/useDecayLoop.ts:94-124 (tick)
- scenario: `viewportDragPan` (packages/core/src/interactions/actions/defaults/viewportDragPan.ts:149-156) starts a decay with `initialPosition` set to the live view and `viewBounds: inertia.bounds`. The drag itself never clamps to `inertia.bounds`, so the view can be released past `minX`. On the first moving tick, `newX < minX` holds whatever the velocity direction, so `dx = minX - posX`: the view jumps the whole overshoot in one frame. Under `'stop'`, `vx` is also zeroed even when the fling was already heading back into bounds. Expected: only motion that crosses a bound outward is clamped, or a view already outside moves smoothly back. Instead a release past the limit teleports to the limit.
- evidence: read
- severity: medium

## A parallax `zoom` factor above 1, or below 0, crosses zero and collapses the plane to `ZOOM_FLOOR`
- where: packages/core/src/core/viewport/parallax.ts:52-55 (trackZoom)
- scenario: `deriveParallaxView(outer, { pan: 1, zoom: 2 })` with `outer.scale.x = 0.4` gives `track(1, 0.4, 2) = 1·(1−2) + 0.4·2 = −0.2`, which `normalizeZoom` turns into `ZOOM_FLOOR`. As the camera zooms out past 0.5, the plane's scale drops from about 0 to the floor, and `planeMap`'s `kx = outer/inner` grows enormous. A negative factor does the same once the camera zooms in far enough (`1 + f(|o|−1) < 0`). `pan` explicitly allows `>1` ("leads"), and `zoom` takes the same `ScalarOrXY` type with no range check or `RangeError`. Expected: the factor is either validated or tracked in a space that cannot go negative (e.g. geometric `|o|^f`). Instead the plane silently degenerates.
- evidence: read
- severity: low

## `fitViewToBounds` lets a NaN viewport size through its "no area" guard and returns a NaN view
- where: packages/core/src/core/viewport/fitViewToBounds.ts:60-66 (fitViewToBounds)
- scenario: `viewportDims = { width: NaN, height: 300 }`, for example from a size read before layout. `NaN <= 0` is false, so the guard that should return `currentView` with a warning is skipped. `Math.max(1, NaN)` is NaN, so `availW` and the scale are NaN. The scale becomes `ZOOM_FLOOR` through `normalizeZoom`, and `x` becomes NaN. The direct caller gets back `{ x: NaN, … }` instead of `currentView`. `animateToBounds` then animates to a floor-zoom view that `normalizeView` repositions to x = 0. Expected: a non-finite dimension is treated like no area (`!(width > 0)`).
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
