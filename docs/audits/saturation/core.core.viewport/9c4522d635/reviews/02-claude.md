# Findings: core.core.viewport

## A coast that starts outside its `bounds` teleports to the bound on its first frame
- where: packages/core/src/core/viewport/useDecayLoop.ts:103 (useDecayLoop tick, boundary branch)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'stop', bounds: { minX: 0 } }`. The drag itself never clamps to `inertia.bounds` (viewportDragPan.ts reads them only at line 155), so the user drags to `view.x = -400` and flings rightward (inward). On the first tick `newX = -400 + dx` is still `< minX`, so `dx = minX - posX = +400` and `vx = 0`: the view jumps 400 world units in one frame and stops dead. With an outward fling the same snap happens (and 'bounce'/'spring' then reflect from the bound). Expected: a position already past a bound coasts inward normally (or eases back), and only a crossing from inside is clamped.
- evidence: read (useDecayLoop.ts tick; viewportDragPan.ts:148-161 passes `initialPosition: v.get()` with no clamp to `inertia.bounds`)
- severity: medium

## `sceneNodeClientRect`'s doc says to return a rect pose directly, but a rotated or transformed pose is silently treated as its unrotated box
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:13-17, 34-36 (SceneNodeClientRectOptions.getWorldBounds / sceneNodeClientRect)
- scenario: following the doc, a caller passes `getWorldBounds: (id) => resolvePose(id)` for a `RectPose` with `rotation: Math.PI / 4`. `Bounds` is geom's `FramedRect`, which declares `rotation` and `transform`, so it type-checks; the function projects only `x, y, width, height` and drops both. The returned client rect is the unrotated box, not the AABB of what is drawn, so a `Callout` anchored to it misses the node's rotated corners. Expected: either project the frame's corners (as `useNodeOverlayFrame` does via `poseFrameOf`) or type the input as a plain `Rect` and fix the doc's "can be returned directly".
- evidence: read (geom/src/poseFrame.ts:30 `FramedRect` carries `rotation?`/`transform?`)
- severity: medium

## `fitViewToBounds` accepts a framed rect and ignores its rotation/transform
- where: packages/core/src/core/viewport/fitViewToBounds.ts:4, 56-72 (fitViewToBounds)
- scenario: `Bounds` is `FramedRect`, so `animateToBounds(nodePose, dims)` with a rotated pose (rotation 45°, 100×10) compiles and fits the unrotated 100×10 box; the drawn shape's diagonal extent (~78×78) overflows the viewport on the narrow axis. Expected: fit the frame's world AABB, or accept only an axis-aligned `Rect` so the mismatch is a type error.
- evidence: read
- severity: low

## `animateToBounds` into a zero-area viewport calls `onDone` while this runner's previous animation keeps moving the camera
- where: packages/core/src/core/viewport/useViewAnimation.ts:194-200 (createViewAnimation animateToBounds)
- scenario: an `animate(to)` is in flight; then `animateToBounds(bounds, { width: 0, height: 0 }, { onDone })` hits the `fitted === current` branch: `onDone` fires immediately but nothing is cancelled, so the camera keeps gliding to the old target after the caller was told the move is done (and the old animation's own `onDone` fires later). Every other call on the runner cancels what it had in flight ("Its own animations run one at a time"). Expected: `cancel()` before reporting done in that branch.
- evidence: read
- severity: low

## A camera animation on a shared animator outlives the component that started it
- where: packages/core/src/core/viewport/useViewAnimation.ts:126-139 (useViewAnimationOn)
- scenario: a panel component calls `useViewAnimationOn(canvasView, canvasAnimator)` and starts `animate(...)`, then unmounts mid-glide. The hook registers no unmount cleanup, so the tween under its `view:<id>` key keeps running on the canvas's animator, writes the camera every frame and fires the unmounted caller's `onDone`. With `useViewAnimation` and no animator passed, the hook's own animator is torn down with it; with a passed one nothing is. Expected: `useEffect(() => () => cancelKey(key), …)`.
- evidence: read (inference that the shared animator does not cancel the key itself; no cleanup in the hook)
- severity: low

## Boundary tracking in the decay loop drifts from the real view when anything else moves it mid-coast
- where: packages/core/src/core/viewport/useDecayLoop.ts:98-125 (tick, `posX`/`posY`)
- scenario: a fling with `boundary: 'stop', bounds: { maxX: 500 }` starts at `view.x = 0`; during the coast a Cmd+wheel zoom about the pointer moves `view.x` by +300 (zoomAt re-anchors the translation). The loop's `posX` only accumulates its own `dx`, so it still thinks x ≈ its own sum and lets the view coast to ~800 before "hitting" 500. Expected: positions read from the live view each tick (or the coast cancelled on any outside write); `onTick` already reads `v.get()` for the delta, so the bound and the view disagree.
- evidence: read (inference that a wheel zoom does not cancel the decay)
- severity: low

## `getVelocity(now)` reports zero for a pointer still moving when only one sample falls in the window
- where: packages/core/src/core/viewport/createVelocityTracker.ts:26-28 (getVelocity)
- scenario: on a slow device moves arrive ~60 ms apart: `record(30, 0, 0)`, `record(30, 0, 60)`, release at `now = 110`. The window `[10, 110]` holds only the t=60 sample, so `s.length < 2` returns `{0, 0}` and the fling is lost, although the pointer covered 30 px in the last 50 ms. Without `now` the same samples give 0.5 px/ms. Expected: the window's span starts at the last sample before the cutoff (whose time bounds the first retained delta), so one in-window delta still yields a velocity.
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

<!-- done: 7 findings, files read: 23 -->
