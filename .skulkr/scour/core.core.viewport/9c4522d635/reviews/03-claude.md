# Findings: core.core.viewport

## A camera animation does not land exactly on its target scale (interpolateView at t=1 ≠ `to`)
- where: packages/core/src/core/viewport/interpolateView.ts:28 (axisCurve)
- scenario: the geometric branch returns `s: s0 * Math.exp(t * lnRatio)` with `lnRatio = Math.log1p((s1 - s0) / s0)`. At t = 1 that is `s0 * exp(log1p(...))`, which rounds and is in general not bit-equal to `s1` (e.g. 0.3 → 2, or a fit scale). The animator's interpolator path hands the factory's value at eased 1 as the final frame (`packages/animator/src/engine/tweenAnimation.ts:66-67`, `factoryFn(1)`, not `o.to`), and `useViewAnimation`'s `onDone` writes `viewTarget.read()`. So `animateToBounds` / `animate({ ... scale: 2 })` leaves the view at e.g. 1.9999999999999998, not 2: `sameView(view, target)` is false, a zoom readout or preset match keyed on the exact scale misses, and `zoomAt`'s "scale unchanged keeps translation exactly" check no longer sees the target scale. The x branch is exact at t=1 (`expm1(-lnRatio)/den` is 1); the scale branch should return `s1` at t = 1 the same way.
- evidence: read
- severity: low

## Parallax `zoom` factor above 1 collapses the plane to ZOOM_FLOOR when the camera is zoomed out
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `trackZoom` moves the magnitude linearly, `track(1, |outer|, factor) = 1 - factor + factor·|outer|`. `pan` documents `>1 = leads`, and the same reading for `zoom` (a plane that zooms faster than the camera) goes negative once `|outer| < 1 - 1/factor`: `zoom: 2` at camera scale 0.4 gives `-0.2`, which `normalizeZoom` turns into 1e-9. The plane's content vanishes, and `planeMap` gives `kx = 0.4 / 1e-9 = 4e8`, so every pointer/marquee mapped through `toPlane` lands ~1e8 world units off. The same happens for any negative `zoom`. Either the magnitude should track geometrically (`|outer|^factor`, which stays positive and still hits 1 and |outer| at 0 and 1), or factors that can go non-positive should be refused.
- evidence: read
- severity: medium

## `widenSlop` converts a world slop at scale 1 when handed a flipped (negative) scale
- where: packages/core/src/core/viewport/screenSlop.ts:47 (widenSlop)
- scenario: `px / (scale > 0 ? scale : 1)` treats any negative scale as "no scale". Every other function in this directory reads a negative scale as a flipped axis with magnitude `|scale|` (`clampView`, `viewportWorldRect`, `meanScale`). A caller passing a signed view scale for a y-up camera at 4× (`scale = -4`) gets the ink's `outsetPx` widened by `px` world units instead of `px / 4`: picks reach 4× too far. Should be `Math.abs(scale)` when finite and non-zero. (The one caller, `pickOutline.ts:50`, passes `opts.scale`, whose sign the type does not pin.)
- evidence: read
- severity: low

## Decay boundary clamping runs against a stale position after any outside camera move
- where: packages/core/src/core/viewport/useDecayLoop.ts:100-130 (tick)
- scenario: `posX/posY` are seeded once from `initialPosition` and then advanced only by the loop's own `dx/dy`. The pan coast's `onTick` (`viewportDragPan.ts:157-160`) applies the delta to whatever `v.get()` currently is. If anything else moves the view during the coast (a key pan, a wheel pan, a `view.set`) without cancelling the decay, `boundary: 'stop'|'bounce'|'spring'` clamps against where the loop thinks the camera is, not where it is: the camera coasts past `bounds` or stops/bounces short of them. Nothing in `DecayLoopOptions` lets the caller resupply the live position each tick (e.g. an `onTick` returning the position, or a `position()` getter).
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
