## A parallax `zoom` factor above 1 collapses the plane to the zoom floor once the camera zooms out far enough
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `deriveParallaxView({ x: 0, y: 0, scale: { x: 0.3, y: 0.3 } }, { pan: 1, zoom: 1.5 })`. `track(1, 0.3, 1.5)` is `1 + (0.3 − 1)·1.5 = −0.05`; `normalizeZoom(−0.05)` returns `ZOOM_FLOOR` (1e-9), so the plane's scale jumps from a sensible value to 1e-9 as the camera crosses scale 1/3, and everything on it shrinks to a point (and `planeMap`'s `kx` becomes ~3e8). `pan` documents factors above 1 ("leads"), and a leading zoom is the same request; the linear blend of the magnitude crosses zero for any `zoom > 1` at camera scale `< 1 − 1/zoom`. Interpolating in log space (`|outer|^factor`) or clamping the blend would keep the plane's zoom monotonic and positive; as written the output is discontinuous and wrong. The 2026-11-10 ruling in `docs/unruled.md` covers offsets that overflow, not this.
- evidence: read (normalizeZoom in packages/geom/src/view.ts:32 maps anything below the floor, negatives included, to ZOOM_FLOOR)
- severity: medium

## A decay whose `initialPosition` is already outside `viewBounds` teleports to the bound in one frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:100-117 (tick, boundary branches)
- scenario: a pan released while rubber-banded past `minX` (posX = minX − 200) with velocity heading back in (vx > 0, small). First tick: `newX = posX + vx·dt` is still `< minX`, so every boundary mode sets `dx = minX − posX` = +200 and reports it through `onTick` in a single frame, then `'stop'` zeroes vx. The view snaps 200 units instantly instead of coasting. The checks only make sense for a position that starts inside the bounds; a start outside them (which an overscroll drag produces) should either coast in or be clamped once explicitly, not hidden in a one-frame jump that `'stop'`'s doc ("clamp at boundary") does not describe.
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
