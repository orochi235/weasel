## A parallax plane with `zoom` above 1 collapses to ZOOM_FLOOR once the camera zooms out far enough
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `deriveParallaxView({ x: 0, y: 0, scale: { x: 0.5, y: 0.5 } }, { pan: 1, zoom: 2 })`. `track(1, 0.5, 2)` = 1·(−1) + 0.5·2 = 0, and `normalizeZoom(0)` returns ZOOM_FLOOR, so the plane's scale jumps to the floor. Any camera scale at or below (zoom − 1)/zoom (0.5 here, 0.75 at zoom 4) does the same. The plane's content shrinks to a speck, and `planeMap`'s `outer.scale / inner.scale` becomes huge, so pointer and marquee mapping into the plane blow up. Between 0.5 and 0.6 the plane's scale falls smoothly toward 0, then snaps to the floor. A negative `zoom` hits the same cliff when the camera zooms in (`track(1, 3, -1)` = −1). `zoom` > 1 is meant to work: `docs/unruled.md:513` rules on planes whose `zoom` is large enough to overflow. The fix should be a curve that stays positive for every factor, such as the magnitude `|outer|^factor`, rather than the linear blend clamped at the floor.
- evidence: read
- severity: low

## `useViewAnimationOn` does not cancel its animation on unmount, so a shared animator keeps writing to a dead channel
- where: packages/core/src/core/viewport/useViewAnimation.ts:150 (useViewAnimationOn)
- scenario: a component calls `useViewAnimationOn(channel, canvasAnimator)` (or `useViewAnimation` with an `animator` passed in), starts `animate(...)` or `animateToBounds(...)`, and unmounts mid-glide while the canvas and its animator stay mounted. The hook has no effect cleanup, so nothing calls `animator.cancelKey(key)`. The tween keeps calling `viewRef.current.set` every frame until it ends, then runs the unmounted caller's `opts.onDone`. It should stop when its owner goes away; `stop()` already does exactly that, and the hook never calls it on unmount. With the hook's own animator (`useViewAnimation` with no animator), it depends on `useAnimator` disposing its animator.
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

<!-- done: 2 findings, files read: 23 -->
