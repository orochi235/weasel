# Findings: core.core.viewport

## A camera animation lands on a scale an ulp or more off the target it was given
- where: packages/core/src/core/viewport/interpolateView.ts:28 (axisCurve)
- scenario: `useViewAnimation.animate` tweens with `interpolator: interpolateView`. The animator's tween, given an interpolator factory, ends on `factoryFn(1)` rather than `o.to` (packages/animator/src/engine/tweenAnimation.ts:66-67), and `onDone` writes `viewTarget.read()`. At t = 1 the geometric branch returns `s0 * Math.exp(lnRatio)` with `lnRatio = log1p((s1 - s0)/s0)`, which is not `s1` in floating point: zooming 1 → 3 lands on `Math.exp(Math.log1p(2))` = 3.0000000000000004, not 3. So the canvas settles on a view that `sameView(view, target)` rejects, a "zoom to 100%" from another scale can settle on 1.0000000000000002, and a thunk step that compounds from `target()` (exact) disagrees with the view actually shown. `x` is exact at t = 1 (the fraction is exactly 1 and `lerp` returns `b` at t = 1); scale should be too — return `s1` when `t === 1`.
- evidence: read (the exp/log1p rounding is inferred, not run)
- severity: medium

## sceneNodeClientRect's doc tells callers to pass a rect pose as its own AABB, which is wrong for a rotated or transformed node
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:13 (SceneNodeClientRectOptions.getWorldBounds), :35
- scenario: the doc says "for rect poses the pose is its own AABB and can be returned directly". `Bounds` is `FramedRect`, which carries `rotation` and `transform` (packages/geom/src/poseFrame.ts:30-37), and `sceneNodeClientRect` reads only `x/y/width/height`. A caller following the doc for a node rotated 45° gets the unrotated box's client rect, so a `Callout` anchored to it points at a box smaller than, and offset from, what is drawn. Either the function should take `poseFrameOf(bounds)` into account (AABB of the framed box's corners) or the doc should stop recommending the raw pose.
- evidence: read
- severity: low

## A parallax `zoom` factor above 1 flattens or inverts the plane when the camera is zoomed out
- where: packages/core/src/core/viewport/parallax.ts:54 (trackZoom)
- scenario: the plane's scale magnitude is `track(1, |outer|, factor)` = `1 + (|outer| − 1)·factor`, linear. With `zoom: 2` (a foreground plane that zooms faster, the counterpart of `pan > 1` which the doc calls "leads") and the camera at 0.4, that is 1 − 1.2 = −0.2; `normalizeZoom` clamps it to `ZOOM_FLOOR`, so the plane collapses to a point, and `planeMap`'s `kx = outer / inner` becomes enormous, sending every pointer mapped through `toPlane` far away. Any camera scale below 1 − 1/factor does this. Tracking in log space (`|outer| ** factor`) keeps the magnitude positive for every factor and still lands on 1 and `|outer|` at 0 and 1.
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
