# Findings: core.core.viewport (blind reviewer)

## A decay starting outside its pan bounds jumps the whole overshoot to the edge in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:98 (useDecayLoop tick, boundary branches)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'stop', bounds: { minX: 0 } }`. The drag itself is not held to
  `inertia.bounds`, so the user drags the view to x = -400 and releases with a small throw (inward or outward).
  `start` takes `initialPosition` -400; on the first moving frame `newX < minX`, so `dx = minX - posX` = +400 and the
  camera snaps 400 world units in a single 16 ms frame (and for 'bounce'/'spring' also reflects velocity from an
  already-crossed wall). It should either clamp the starting position once without treating it as a coast step, or
  move toward the bound at the coast's own speed; a single-frame teleport is not a coast.
- evidence: read (viewportDragPan.ts:149-160 passes `initialPosition: v.get()` with no check against `inertia.bounds`)
- severity: low

## A parallax `zoom` factor above 1 (or below 0) collapses the plane to ZOOM_FLOOR when the camera zooms out
- where: packages/core/src/core/viewport/parallax.ts:53 (trackZoom)
- scenario: `deriveParallaxView({ x: 0, y: 0, scale: { x: 0.4, y: 0.4 } }, { pan: 1, zoom: 2 })`:
  `track(1, 0.4, 2)` = 1·(−1) + 0.4·2 = −0.2, which `normalizeZoom` turns into `ZOOM_FLOOR` (1e-9). The plane is drawn at
  a billionth scale and `planeMap`'s scale becomes 4e8, so a pointer mapped into it lands absurdly far away. As the camera
  passes scale 0.5 the plane jumps from a finite zoom to the floor discontinuously. `pan` documents `>1 = leads`, and
  nothing rejects `zoom > 1` or `zoom < 0`; either the factor should be validated (throw, as `checkInertia` does for
  friction) or the magnitude tracked geometrically (`|outer|^factor`), which stays positive for every factor.
- evidence: read (`normalizeZoom` in packages/geom/src/view.ts:32 returns ZOOM_FLOOR for any value below it)
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
