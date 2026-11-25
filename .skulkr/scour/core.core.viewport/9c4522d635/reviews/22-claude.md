# Findings: core.core.viewport

## sceneNodeClientRect's documented "return a rect pose directly" drops rotation and transform, so a rotated node gets the wrong anchor rect
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:14 (SceneNodeClientRectOptions.getWorldBounds doc), :35 (sceneNodeClientRect)
- scenario: the doc says "for rect poses the pose is its own AABB and can be returned directly". `Bounds` is geom's `FramedRect`, which carries optional `rotation` and `transform`, so a `RectPose` with `rotation: Math.PI / 4` type-checks as a return value. `sceneNodeClientRect` projects only `x, y, x + width, y + height` and ignores both fields. A 100×10 node rotated 90° gives a 100×10 client rect when the drawn node covers 10×100, so a `Callout` anchored to it points at empty canvas. The function should take the AABB of `poseFrameOf(bounds)` applied to the box's corners, or the doc should limit "return directly" to unrotated, untransformed poses.
- evidence: read (packages/geom/src/poseFrame.ts:25-37 for the FramedRect fields)
- severity: medium

## deriveParallaxView's zoom factor above 1 drives the plane's scale through zero, where it is clamped to ZOOM_FLOOR and the plane vanishes
- where: packages/core/src/core/viewport/parallax.ts:56 (trackZoom)
- scenario: `pan` documents factors above 1 ("leads"), and `zoom` is described as "the same for scale". But `trackZoom` computes the magnitude linearly as `1 + factor * (|outer| - 1)`. With `zoom: 2` and the camera zoomed out to 0.4, that is `-0.2`. `normalizeZoom` maps anything under the floor (`zoom >= ZOOM_FLOOR ? zoom : ZOOM_FLOOR`) to 1e-9, so the plane draws at a scale of 1e-9 and its contents collapse to a point, which is a cliff rather than a continuous lead. A negative factor fails the same way once zoomed in past `1 + 1/|factor|`. The fix is to interpolate the magnitude geometrically (`|outer| ** factor`), which matches `interpolateView`'s log-scale camera curve, or to reject factors outside [0, 1].
- evidence: read (packages/geom/src/view.ts:32-34 for normalizeZoom)
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
