# Findings: core.core.viewport (blind reviewer)

## A parallax `zoom` factor above 1 (or below 0) collapses the plane to ZOOM_FLOOR when the camera's zoom crosses a threshold
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `deriveParallaxView({ x: 0, y: 0, scale: { x: 0.4, y: 0.4 } }, { pan: 1, zoom: 2 })`: `track(1, 0.4, 2)` = 1·(1−2) + 0.4·2 = −0.2, and `normalizeZoom(-0.2)` returns `ZOOM_FLOOR` (1e-9). The plane's scale jumps to 1e-9, which draws its content at a point, and `planeMap` divides by it (kx = 0.4 / 1e-9 = 4e8), so pointer mapping into the plane explodes. At an outer zoom of exactly 0.5 the magnitude is 0 and lands on the floor too. A negative factor does the same once |outer| > 1 − 1/factor (zoom −1, outer 3: 2 − 3 = −1). `pan` is documented to take values above 1 ("leads"), `ScalarOrXY` admits any number for `zoom`, and nothing validates it, so a "zoom leads" plane silently vanishes when the camera zooms out past 1/factor·(factor−1). Should either reject factors outside [0, 1] or interpolate magnitude geometrically (|outer|^factor), which stays positive for every factor.
- evidence: read (normalizeZoom in packages/geom/src/view.ts:32 maps any value below ZOOM_FLOOR to ZOOM_FLOOR)
- severity: medium

## A coast released outside its `bounds` teleports to the boundary in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:94-117 (tick)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'spring', bounds: { minX: 0 } }`. The drag itself never applies `inertia.bounds` (viewportDragPan.ts onMove sets the view unclamped), so a user can drag to `view.x = -500` and fling. `initialPosition` is `-500`; on the first moving frame `newX < minX`, so `dx = minX - posX = +500`, and the view jumps 500 world units in a single frame — for every boundary mode, and regardless of the fling's direction (a fling back inward with newX still below minX also jumps). `'spring'` and `'bounce'` read as eased returns but snap instead. The boundary branches should only clamp a step that crosses the limit from inside, or ease a start outside back in.
- evidence: read (viewportDragPan.ts:132-138 and :149-161)
- severity: medium

## The invalid-view warning says a view's zoom is "always positive", contradicting the flipped-axis invariant
- where: packages/core/src/core/viewport/zoomBounds.ts:25-28 (warnInvalidView)
- scenario: `normalizeView({ x: 0, y: 0, scale: { x: 1, y: 0 } })` in dev warns "A view's zoom is always positive and finite". Negative scales are valid (y-up; view.ts documents "A negative axis is a flipped one ... and keeps its sign"), so a developer reading the warning while debugging a flipped camera is told their legal `scale.y = -1` is invalid. Should say "nonzero" / "magnitude at least ZOOM_FLOOR".
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
