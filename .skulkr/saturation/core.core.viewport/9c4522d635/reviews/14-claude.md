# Findings: core.core.viewport (viewport-saturation)

## A coast that starts past a pan limit teleports onto it in one frame, while a slow release past it stays outside
- where: packages/core/src/core/viewport/useDecayLoop.ts:98 (tick, boundary branches)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'stop', bounds: { minX: 0 } }`. The drag itself never clamps to `inertia.bounds` (viewportDragPan.ts onMove sets the view freely), so the user drags to view.x = -400 and flicks. `start` seeds `posX = -400`; the first tick computes `newX < minX` and sets `dx = minX - posX = 400`, so the camera jumps 400 world units in a single frame (and `vx` is zeroed even when it pointed back inside). `'bounce'`/`'spring'` take the same one-frame jump. Released slowly instead (speed < minSpeed), `start` ends at once and the view stays at -400, outside the limit. The same limit is enforced instantly or not at all depending on release speed; a position already past a bound should either be left alone by the clamp until it re-enters or eased back, not snapped.
- evidence: read (useDecayLoop.ts tick + start; viewportDragPan.ts:109-161)
- severity: medium

## `Bounds` admits `rotation` / `transform`, which `fitViewToBounds` and `sceneNodeClientRect` silently drop
- where: packages/core/src/core/viewport/fitViewToBounds.ts:4,62 (fitViewToBounds); packages/core/src/core/viewport/sceneNodeClientRect.ts:14,34 (sceneNodeClientRect)
- scenario: `Bounds` is geom's `FramedRect`, which carries optional `rotation` and `transform` (poseFrame.ts:30). Both functions read only x/y/width/height. `sceneNodeClientRect`'s own doc tells callers "for rect poses the pose is its own AABB and can be returned directly" — a RectPose with `rotation: Math.PI/4` returned from `getWorldBounds` yields the unrotated box, so a `Callout` anchors to a rect that does not cover the drawn node (corners stick out by up to ~41% of the side). Same for `fitViewToBounds` / `animateToBounds` given a rotated pose: the fit frames the unrotated box and clips the rotated node's corners. Either the parameter type should be a plain `Rect` (so a pose doesn't typecheck silently) or the frame should be folded into an AABB.
- evidence: read
- severity: medium

## `normalizeView` turns a `-Infinity` scale into a positive one, flipping a y-up camera
- where: packages/core/src/core/viewport/view.ts:65 (normalizeAxis)
- scenario: `normalizeAxis(-Infinity)`: the guard `s < 0 && s > -Infinity` is false, so it falls to `normalizeZoom(-Infinity)` which returns `+ZOOM_FLOOR`. A y-up view whose scale overflowed negative (e.g. a zoom factor product or `1/-0`) comes back with `scale.y > 0`, turning the world upside down, although the doc says "a negative one keeps its sign". `-Infinity` should map to `-ZOOM_FLOOR` (or `-max`). Reaches `zoomAt` and `useViewAnimation`'s writes, both of which pass through `normalizeView`.
- evidence: read (geom normalizeZoom: `zoom >= ZOOM_FLOOR && zoom < Infinity ? zoom : ZOOM_FLOOR`)
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
