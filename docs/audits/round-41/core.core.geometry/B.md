## outsetBox/insetBox grow a flipped (negative-extent) box inward, so a resize dragged past the opposite edge hands constraints a drawn box 2×extent too small
- where: packages/core/src/core/geometry/inkExtents.ts:38 (outsetBox)
- scenario: the resize session builds `moved` with `movedEdges` (packages/editing/src/actions/resize/frame.ts:169-170), which leaves `width` negative once the right edge is dragged left of the left edge. Box x=0,w=100 with a 10-wide centered stroke (extents 5 each side), dragged to w=-50: `moved` spans [-50,0]; `outsetBox` gives x=-5, w=-40, i.e. [-45,-5] — the ink box shrunk by 5 per side instead of grown to [-55,5]. Constraints (`constrain(...)`, snap/min-size/containment rules) and `edgeAspect` then judge a drawn box 10 units narrower than the ink, so e.g. a keep-inside-page constraint lets the stroke poke 5 past the page while flipped. `outsetBox` should apply the extents on the sides the box actually spans (swap left/right when width<0, top/bottom when height<0), or the caller should normalize first.
- evidence: read
- severity: medium

## pathPoseDescriptor.lerp/axes morph polygons whose command streams differ, and lerp(a, b, 1) is not b
- where: packages/core/src/core/geometry/pathPoseDescriptor.ts:42 (lerp), :73 (axes)
- scenario: the compatibility test is only `a.coords.length === b.coords.length`; `commands`, `fillRule` and `openFill` all come from `a` (`...bare`). Two polygons with the same coord count but a different command structure — `M L L L` (8 coords) vs `M C` (8 coords) — interpolate coordinates under `a`'s commands, so every mid-frame interprets curve control points as line vertices, and at t=1 the result is b's coordinates drawn with a's commands (a different shape than b) and a's fill rule. Expected: either a shape-equal end state (t=1 → b) or the "incompatible path shapes" throw for mismatched `commands`. The `axes` path has the same gap: `count` is `like.coords.length` and `from` rebuilds with `like`'s commands, so an animation to a target with other commands lands on the wrong shape.
- evidence: read
- severity: low

## rotatedRectContainsPoint / rotatedRectCorners ignore the pose's `transform` and its sign, answering differently from poseFrameOf
- where: packages/core/src/core/geometry/rotatedRect.ts:36 (rotatedRectCorners), :44 (rotatedRectContainsPoint)
- scenario: `RotatedPose extends Bounds`, which is geom's `FramedRect` and so may carry a `transform` (skew / per-axis scale written by `remapRotatedLeaf` on every group resize of a turned leaf). Both public helpers (exported via `barrel/interactions.ts`) rotate about the center and drop `transform`, so for a leaf that `remapRotatedLeaf` gave `transform: [1, 0.5, 0, 1]`, the corners they report and the hit they answer disagree with where `poseFrameOf`/`targetCorners` say the node draws. Separately, `rotatedRectContainsPoint` tests `local.x >= pose.x && local.x <= pose.x + pose.width`, which is never true for a flipped box (negative width, as a resize past the opposite edge leaves — see `positiveBox`), so a point inside such a box misses it.
- evidence: read
- severity: low

## AUTO_POSE_DESCRIPTOR.lerp sends a Path/rect mixed pair to the rect kernel, producing a NaN-filled hybrid pose
- where: packages/core/src/core/geometry/autoPoseDescriptor.ts:44 (lerp)
- scenario: `lerp(a, b)` with a polygon Path `a` and a plain rect pose `b` (a node whose pose kind changed between keyframes, e.g. converted to a path) falls to `RECT_POSE_DESCRIPTOR.lerp`, which spreads the polygon and writes `x/y/width/height` from `undefined` → a `{kind:'polygon', commands, coords, x: NaN, …}` hybrid instead of a throw or a snap. Every other method dispatches on one pose; here the "both Path" test sends a half-Path pair to the rect kernel, which can't read either.
- evidence: read
- severity: low

## Files read
packages/core/src/core/geometry/autoPoseDescriptor.ts
packages/core/src/core/geometry/booleanOfPaths.ts
packages/core/src/core/geometry/circlePose.fixture.ts
packages/core/src/core/geometry/inkExtents.ts
packages/core/src/core/geometry/pathPoseDescriptor.ts
packages/core/src/core/geometry/poseDescriptor.ts
packages/core/src/core/geometry/rectPose.ts
packages/core/src/core/geometry/regionHit.ts
packages/core/src/core/geometry/rotatedRect.ts
packages/core/src/core/geometry/targetFrame.ts
packages/core/src/core/geometry/unionBounds.ts
packages/core/src/core/geometry/vec2.ts

<!-- done: 4 findings, files read: 12 -->
