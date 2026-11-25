## fitSize / useFitOnce skip the kit-wide zoom clamp every other zoom path defaults to
- where: packages/core/src/core/viewport/fitSize.ts:26 (fitZoom), packages/core/src/core/viewport/useFitOnce.ts:24 (useFitOnce)
- scenario: `useFitOnce(800, 600, 4, 3, …)` (tiny content) fits at zoom ≈ 170; `fitZoom` with no `clamp` uses `[-Infinity, Infinity]`, so nothing bounds it, and `useFitOnce` passes `undefined`. `zoomBounds.ts` says every zoom path defaults from `DEFAULT_MIN_ZOOM`/`DEFAULT_MAX_ZOOM` precisely so "a fit could legally land at 10x and the next pinch frame would clamp it back to 8x" cannot happen; `fitViewToBounds` does default to them. Here the fit lands at 170x and the first wheel/pinch through `zoomAt` snaps it to 8x. Should default `min`/`max` to the kit clamp as `fitViewToBounds` does.
- evidence: read
- severity: medium

## interpolateView takes the linear, drifting path for a flipped (y-up) camera even when both endpoints share a sign
- where: packages/core/src/core/viewport/interpolateView.ts:17 (axisCurve)
- scenario: animating a y-up view `{y: 0, scale.y: -1}` → `{y: 100, scale.y: -4}` (an animated zoom or fit on a y-up canvas, which `fitViewToBounds` preserves). `!(s0 > 0)` sends it to `linear`, so scale moves linearly and the world point under the zoom's fixed screen point drifts mid-animation — the exact defect the geometric branch exists to prevent — while the x axis (positive) of the same view animates anchored. The stated reasons (negative ratio → NaN, no path across a sign change) only apply to a sign *change*; for two negative scales `s1/s0 > 0`, `Math.pow` is finite and `p = (x1-x0)/(1/s0-1/s1)` is valid. The test only covers a mirror flip (sign change).
- evidence: read
- severity: medium

## useDecayLoop accepts friction ≥ 1 and minSpeed ≤ 0, and then coasts forever; momentum() refuses the same input
- where: packages/core/src/core/viewport/useDecayLoop.ts:140 (start), :79–88 (tick)
- scenario: `start({ velocity: {vx: 1, vy: 0}, friction: 1, onTick })` — `f = 1` every frame, speed never drops below `minSpeed`, the rAF loop runs and calls `onTick` until unmount (`friction > 1` accelerates to Infinity and feeds `onTick(Infinity, …)`). Likewise `minSpeed: 0` with any friction < 1: speed underflows to exactly 0 and `0 < 0` is false, so the loop requests frames forever with `dx = dy = 0`. `docs/unruled.md` (2026-11-18) rules that `momentum()` throws a RangeError on friction outside (0, 1) because 1 "coasted forever"; this hook, which takes the same `InertiaOptions.friction`, answers the same input the other way.
- evidence: read
- severity: medium

## getVelocity divides by the samples' own span, not the window before `now`, so a pointer that paused before release still flings at full speed
- where: packages/core/src/core/viewport/createVelocityTracker.ts:26–32 (getVelocity)
- scenario: moves of 10 px at t=0 and t=10 (1 px/ms), then the pointer holds still (no pointermove events fire while stationary) and is released at `now = 95`. Both samples are inside `now - 100`, `dt = 10`, velocity = 1 px/ms — the full throw speed, though the doc says it is "the velocity over the 100ms before `now`" and that a pointer "that came to rest before it was let go reports none". Only a rest longer than 100 ms reports zero; a 50–90 ms pause before release (a deliberate stop-then-lift) still throws. Using `now - s[0].t` (or `now` as the span's end) as `dt` when `now` is given would match the doc.
- evidence: read
- severity: medium

## A one-axis zoom moves the other axis when that axis's scale is outside the clamp, contrary to axisZoomFactor's contract
- where: packages/core/src/core/viewport/zoomAt.ts:31 (axisZoomFactor), :61–69 (zoomAt)
- scenario: view `scale {x: 1, y: 12}` (e.g. a `defaultView`, or a canvas whose `maxZoom` is lower than the view it was given) and `zoomAt(view, anchor, axisZoomFactor(2, 'x'))`. The y factor is 1, but `clampScale(12, 1, 0.1, 8)` returns 8, so `nextY !== view.scale.y`, y's scale jumps to 8 and its translation is re-anchored. `axisZoomFactor`'s doc promises the other axis's "scale and its translation [stay] where they were". Same for a ctrl+wheel sample with `deltaY = 0` (factor 1 on both axes) snapping an out-of-range view.
- evidence: read
- severity: low

## interpolateView loses precision mid-animation for scales that differ just above the 1e-12 threshold
- where: packages/core/src/core/viewport/interpolateView.ts:19–25 (axisCurve)
- scenario: `from {x: 0, s: 1}` → `to {x: 1e6, s: 1 + 1e-11}`. Relative difference 1e-11 passes the `1e-12` equal-scale test, so `p = 1e6 / ~1e-11 ≈ 1e17` and `w ≈ 1e17`; every frame computes `x = w - p/s`, a cancellation of two ~1e17 values with ulp ≈ 16, so intermediate frames jump by world units of tens of pixels' worth before the animator snaps to `to` at t = 1. The threshold should scale with the pan distance (or fall back to linear when `|p|` is huge relative to the endpoints), not be a fixed relative-scale epsilon.
- evidence: read
- severity: low

## Files read
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

<!-- done: 6 findings, files read: 22 -->
