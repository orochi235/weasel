# Findings: core.core.viewport

## A coast that starts outside its `viewBounds` teleports to the bound on its first frame, even when moving inward
- where: packages/core/src/core/viewport/useDecayLoop.ts:104 (tick, boundary branch)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'stop' | 'bounce' | 'spring', bounds: { minX: 0 } }`. The drag itself is not clamped, so the user drags the view to x = -500 and flings it back toward the bounds (vx > 0). `initialPosition.x = -500`; the first moving tick computes `newX = -500 + vx*dt`, still `< minX`, so `dx = minX - posX = +500` and the view jumps 500 world units in one frame (and `'stop'` also zeroes `vx`). Expected: a position already outside the bound moving inward should be left to move by `vx*dt` (or eased back), not snapped; only a crossing from inside to outside should be clamped.
- evidence: read
- severity: medium

## The coast's stop speed is compared in world units, so how long a fling coasts on screen depends on the zoom
- where: packages/core/src/core/viewport/useDecayLoop.ts:89 (tick, `speed < s.minSpeed`)
- scenario: `viewport.dragPan` hands `useDecayLoop` a velocity converted to world units/ms (`-vx / scale.x`), and the loop compares it to `minSpeed` (default 0.01). The on-screen stop threshold is therefore `0.01 × scale` px/ms: at zoom 0.1 a 2 px/ms fling coasts ~91 frames down to 1 px/s of invisible creep, at zoom 8 it is cut off after ~39 frames at 80 px/s, a visible stop. The same fling should feel the same at every zoom; the threshold wants screen units (or the loop needs the scale).
- evidence: read (computed from friction 0.92: ln(0.01·s/2)/ln 0.92)
- severity: low

## `sceneNodeClientRect` drops a `Bounds`' rotation and transform, though its doc says a rect pose can be returned directly
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:33 (sceneNodeClientRect)
- scenario: `Bounds` is geom's `FramedRect`, which carries `rotation?` and `transform?`. Following the doc ("for rect poses the pose is its own AABB and can be returned directly"), a caller returns a rect pose `{x:0,y:0,width:100,height:10,rotation:Math.PI/2}`. The function projects only `x..x+width × y..y+height`, so a Callout anchors to a 100×10 horizontal box where the node draws a 10×100 vertical one. Either the type should be a plain `Rect`/the doc should say to take `boundsOfPath`, or the frame should be applied.
- evidence: read
- severity: low

## `fitViewToBounds` accepts a `FramedRect` and ignores its `rotation` / `transform`
- where: packages/core/src/core/viewport/fitViewToBounds.ts:66 (fitViewToBounds)
- scenario: `Bounds` is re-exported as geom's `FramedRect`, so a caller (or `animateToBounds`) can pass a node's rotated pose directly. The fit uses only `width`/`height`/`x`/`y`, so a 1000×10 rect rotated 90° is fit as a wide strip: its vertical extent overflows the viewport by ~100×. Expected: fit the frame's AABB, or type the parameter as an unframed `Rect` so the mistake can't typecheck.
- evidence: read
- severity: low

## `fitViewToBounds` turns a `NaN` viewport dimension into a `NaN` view instead of the zero-area fallback
- where: packages/core/src/core/viewport/fitViewToBounds.ts:61 (fitViewToBounds)
- scenario: `viewportDims = { width: NaN, height: 600 }` (a size read from an unmounted element via arithmetic). `NaN <= 0` is false, so the guard passes, `availW = Math.max(1, NaN)` is `NaN`, the scale clamps fall back to `normalizeZoom(NaN)` = `ZOOM_FLOOR`, and `place` yields `x: NaN`. The caller receives a non-total view (only `normalizeView` downstream rescues it, to x = 0 at ZOOM_FLOOR). The guard should be `!(width > 0 && height > 0)` so it returns `currentView` as documented.
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
