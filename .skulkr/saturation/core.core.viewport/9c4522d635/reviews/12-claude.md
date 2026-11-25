# viewport-saturation findings: core.core.viewport

## useViewAnimationOn never cancels its animation on unmount, so a tween on a shared animator keeps writing to a dead channel
- where: packages/core/src/core/viewport/useViewAnimation.ts:103 (useViewAnimationOn)
- scenario: a component calls `useViewAnimationOn(channel, sharedAnimator)` (or `useViewAnimation(channel, sharedAnimator)`), starts `animate(...)`, then unmounts mid-flight. The hook has no effect cleanup calling `animator.cancelKey(key)`, so the tween runs on the animator that outlives it and keeps calling `viewRef.current.set(...)` on the unmounted owner's channel each frame until done, then fires `opts.onDone` for a component that is gone. The animation should be canceled when the runner unmounts. Only the own-animator path (`useAnimator()`) is covered, because that animator is torn down with the component.
- evidence: read (no useEffect anywhere in the file; `cancel` is reachable only via `stop`/`stopIfExternal`)
- severity: medium

## A parallax `zoom` factor above 1 drives the plane's scale through zero to ZOOM_FLOOR when the camera zooms out
- where: packages/core/src/core/viewport/parallax.ts:52 (trackZoom)
- scenario: `deriveParallaxView(outer, { pan: 1, zoom: 2 })` with `outer.scale.x = 0.4`: `track(1, 0.4, 2) = 1·(−1) + 0.8 = −0.2`, which `normalizeZoom` (`zoom >= ZOOM_FLOOR ? zoom : ZOOM_FLOOR`) turns into ZOOM_FLOOR. The plane collapses to a near-zero scale, and `planeMap`'s `kx = outer/inner` becomes huge, so pointer mapping into the plane is garbage. `pan` documents `>1 = leads`, and `zoom` takes the same `ScalarOrXY` with no range check. So a "leading" zoom is accepted, and it breaks for every camera zoom below `(f−1)/f`. It should either interpolate the magnitude geometrically (`|outer|^f`, which stays positive) or reject `zoom` outside [0, 1].
- evidence: read (normalizeZoom at packages/geom/src/view.ts:32)
- severity: medium

## useDecayLoop boundary handling teleports a coast that starts outside its bounds to the edge in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:104 (tick, boundary branches)
- scenario: `start({ velocity: { vx: -2, vy: 0 }, viewBounds: { maxX: 100 }, boundary: 'stop' | 'bounce' | 'spring', initialPosition: { x: 300, y: 0 } })`. This is a release past the limit while moving back toward it. On the first moving frame `newX = 300 − 2·dt > maxX`, so `dx = maxX − posX = −200`: the view jumps 200 units in one frame. For `'stop'` it also kills `vx`. For `'bounce'`/`'spring'` it sets `vx = −|vx|`, the direction it already had. The branches assume the position starts inside the bounds. A coast moving toward the bounds from outside should just move, or ease in, not snap.
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
