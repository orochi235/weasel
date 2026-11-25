## A parallax `zoom` factor above 1 collapses the plane to ZOOM_FLOOR once the camera zooms out
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `deriveParallaxView({x:0,y:0,scale:{x:0.4,y:0.4}}, { pan: 1, zoom: 2 })`. `track(1, 0.4, 2)` = 1·(1−2) + 0.4·2 = −0.2, and `normalizeZoom(−0.2)` returns `ZOOM_FLOOR`, so the plane's scale jumps from a normal value (0.6 at camera 0.8, 0.2 at camera 0.6) to the floor at camera 0.5 and below: the plane shrinks to a point instead of continuing to lead the zoom. `pan` documents `>1 = leads`, and `zoom` is "the same for scale", so a leading zoom is a real input. The blend is linear in scale, so any factor >1 crosses zero at camera scale `1 − 1/factor`; a geometric blend (`|outer|^factor`) would keep it positive. `planeMap` then divides by that floor scale, so pointer mapping into the plane is wildly off too.
- evidence: read (normalizeZoom in packages/geom/src/view.ts:32 returns ZOOM_FLOOR for anything below it)
- severity: medium

## useDecayLoop clamps the coast against its own position counter, not the view, so any other move during a coast puts the bounds in the wrong place
- where: packages/core/src/core/viewport/useDecayLoop.ts:103-125 (tick)
- scenario: a hand-tool pan with `inertia: { boundary: 'stop', bounds }` is flung; while it coasts, a wheel pan or a key nudge moves the view by 500 units. `viewportDragPan`'s `onTick` applies each `dx` to the live view (`v.get()`), but `tick` tests `s.posX + dx` against `minX/maxX`, where `posX` started at `initialPosition` and only ever adds the decay's own deltas. The coast therefore stops 500 units short of, or 500 units past, the configured limit. The same happens when `viewBounds` is set with no `initialPosition` (documented "required" but silently defaulted to 0): the clamp is applied as if the view started at the origin.
- evidence: read (caller packages/core/src/interactions/actions/defaults/viewportDragPan.ts:149-160)
- severity: low

## animateToBounds into a zero-area viewport fires onDone while the runner's previous animation keeps moving the view
- where: packages/core/src/core/viewport/useViewAnimation.ts:184-191 (animateToBounds)
- scenario: `animate(A)` is in flight; then `animateToBounds(b, { width: 0, height: 300 }, { onDone })`. `fitViewToBounds` returns `current`, so the code calls `onDone` at once and returns `true` without cancelling, and the earlier animation carries on to A. Every other call from this runner cancels what it had in flight (doc: "Its own animations run one at a time"; `animate` registers under the same cancel key), so the caller is told the fit has finished while the camera is still gliding to a different target, and `target()` still reports A.
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
