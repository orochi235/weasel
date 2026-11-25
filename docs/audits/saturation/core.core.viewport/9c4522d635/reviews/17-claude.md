# Findings: core.core.viewport (blind reviewer)

## sceneNodeClientRect drops a rotated or transformed box's frame, though its doc tells callers to pass a rect pose directly
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:15 (SceneNodeClientRectOptions.getWorldBounds doc), :34-36 (sceneNodeClientRect)
- scenario: `Bounds` is geom's `FramedRect`, which carries an optional `rotation` and `transform`. The doc says "for rect poses the pose is its own AABB and can be returned directly". So a caller returns a node's `RectPose` `{x:0,y:0,width:100,height:10,rotation:Math.PI/2}`. The function projects only the corners `(x, y)` and `(x+w, y+h)`, which gives a 100×10 client rect. The node is actually drawn as a 10×100 box turned about its center, so a `Callout` anchored to that rect points at empty canvas. It should either take the AABB of the framed box (`poseFrameOf`) or type its input as a plain `Rect` and drop the doc's advice.
- evidence: read (FramedRect at packages/geom/src/poseFrame.ts:30-36)
- severity: medium

## fitViewToBounds accepts a FramedRect but ignores its rotation and transform
- where: packages/core/src/core/viewport/fitViewToBounds.ts:4 (Bounds = FramedRect), :66-117 (fitViewToBounds); the same applies to `animateToBounds` in useViewAnimation.ts:194
- scenario: the parameter type admits `rotation` / `transform`, so `animateToBounds(nodePose, dims)` on a rotated node typechecks. The fit then frames the unrotated box. A 1000×10 rect rotated 90° gets a scale fitted to a 1000-wide strip, so it is drawn about 1000 tall and runs off the top and bottom of the viewport. Either the framed box's AABB should be fitted, or the input should be typed as `Rect` so the frame cannot be dropped silently.
- evidence: read
- severity: low

## useDecayLoop teleports to the boundary in one frame when the coast starts outside the bounds
- where: packages/core/src/core/viewport/useDecayLoop.ts:103-120 (tick)
- scenario: `start({ velocity:{vx:0.5,vy:0}, viewBounds:{minX:0}, boundary:'stop', initialPosition:{x:-500,y:0} })`. This is a release after a drag pulled the view past its limit (overscroll), with a fling back toward the bounds. On the first moving frame `newX = -500 + 8 < 0`, so `dx = minX - posX = 500` and `vx = 0`. The view jumps 500 units in one frame. Under `'bounce'`/`'spring'` a fling *outward* from outside the bounds is likewise snapped to the edge and reflected. A position already out of bounds should coast or settle back, not be clamped in a single frame.
- evidence: read
- severity: low

## useDecayLoop clamps against a position of 0 when viewBounds is given without initialPosition
- where: packages/core/src/core/viewport/useDecayLoop.ts:145 (start)
- scenario: the doc says `initialPosition` is "Required when `viewBounds` is set", but nothing enforces it: `posX`/`posY` silently default to 0. A view at x=2000 with `viewBounds:{maxX:2500}` and no `initialPosition` lets the coast run 2500 units past where it is, and so 2000 past the real limit. It should throw or warn on the missing field instead of guessing.
- evidence: read
- severity: low

## animateToBounds into a zero-area viewport fires onDone while the runner's previous animation keeps moving the camera
- where: packages/core/src/core/viewport/useViewAnimation.ts:198-199 (animateToBounds)
- scenario: `animate(A)` is in flight, then `animateToBounds(b, {width:0,height:300}, {onDone})`. `fitViewToBounds` returns `current`, so `onDone` is called at once and nothing is canceled. The camera carries on to `A`. `onDone` is documented as "Fires when the target is reached", but the caller is told the move is finished while the view is still animating somewhere else. Every other `animate*` call cancels this runner's in-flight animation first.
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
