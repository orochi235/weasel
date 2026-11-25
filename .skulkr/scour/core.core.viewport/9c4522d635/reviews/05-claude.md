## useDecayLoop tracks the pan limits against a private copy of the position, which drifts from the real view when anything else moves the camera mid-coast
- where: packages/core/src/core/viewport/useDecayLoop.ts:98 (tick, boundary block); position seeded once at :150 (start)
- scenario: a hand-tool fling with `boundary: 'stop'` and `bounds` starts coasting with `posX` = view.x at release. While it coasts, a wheel pan or a key nudge moves the view by +500 (viewportDragPan's `onTick` adds dx to whatever `v.get()` now holds). `posX` never learns of it, so the limit is checked 500 units off: the real view coasts 500 units past `maxX`, or stops 500 units short of it. The boundary should be checked against the view the deltas are applied to. Whether every outside write calls `stopDecay` first was not traced; if any does not, this shows up.
- evidence: read (the drift follows from the code; I did not reproduce it)
- severity: low

## A new `start`, or `cancel`, drops the coast in flight without calling its `onEnd`
- where: packages/core/src/core/viewport/useDecayLoop.ts:135 (cancel), :142 (start calls cancel)
- scenario: a caller passes `onEnd` to clear a "coasting" flag or release a resource. A second fling before the first coast ends (or `stopDecay` → `cancel`) sets `stateRef` to null and the first `onEnd` never runs, so the flag stays set. A coast that ends on `minSpeed`, or whose velocity is too small to start, does call `onEnd`, so whether it fires depends on how the coast ended. `DecayLoopOptions.onEnd` gives no hint that it is skipped on cancel (compare `ViewAnimationOptions.onDone`: "Not called on cancel").
- evidence: read
- severity: low

## A parallax `zoom` factor above 1 drops the plane to ZOOM_FLOOR once the camera zooms out far enough
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `zoom: 2` (a plane that overshoots the camera's zoom, the same way `pan > 1` "leads"), camera at scale 0.4: track(1, 0.4, 2) = 1 + 2·(0.4 − 1) = −0.2, which `normalizeZoom` turns into `ZOOM_FLOOR`. The plane drops to the floor scale and stays there for every camera scale below 0.5 (at 0.5 the magnitude is exactly 0). A negative `zoom` factor does the same when the camera zooms in past 1. Interpolating the magnitude in log space, or clamping, would keep it positive. `pan` documents >1, `zoom` documents neither a range nor a throw.
- evidence: read (normalizeZoom in packages/geom/src/view.ts:32 maps anything below the floor to the floor)
- severity: low

## fitSize gives an empty viewport a fit; fitViewToBounds refuses one
- where: packages/core/src/core/viewport/fitSize.ts:50 (fitSize)
- scenario: `fitSize(0, 0, 200, 100)`: availW/availH clamp to 1, so zoom clamps to DEFAULT_MIN_ZOOM (0.1) and pan becomes (−10, −5). A public caller applies a 10% zoom before layout. `fitViewToBounds` handles the same input by warning and returning the current view, and `useFitOnce` only works because it checks `width > 0` itself. Two fit entry points answer "viewport has no area" two different ways.
- evidence: read
- severity: low

## Swapping the animator under useViewAnimationOn leaves the old animator's tween running where no stop or cancel reaches it
- where: packages/core/src/core/viewport/useViewAnimation.ts:191 (cancel), :180 (isAnimating)
- scenario: a camera tween is in flight on animator A, then the component re-renders with animator B (the `animator` prop changes). `animatorRef` now points at B, so `stop()`, `stopIfExternal()` and the next `animate()`'s implicit cancel all call `B.cancelKey(key)`. The tween on A keeps writing the view until it finishes, fighting the new animation, and `isAnimating()` reports false while it runs.
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

<!-- done: 5 findings, files read: 23 -->
