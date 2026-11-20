## RECT_POSE_DESCRIPTOR.lerp never interpolates `transform`, so lerp(a, b, 1) is not b for poses whose transforms differ
- where: packages/core/src/core/geometry/poseDescriptor.ts:121 (RECT_POSE_DESCRIPTOR.lerp)
- scenario: a = {x,y,w,h, transform:[1,0.5,0,1]}, b = {x,y,w,h} (skew removed, e.g. by remapRotatedLeaf deleting it). `lerp(a, b, t)` spreads `...a`, so every t, including t = 1, returns a's skew; the animation ends on a pose that is still skewed while the target is not. The reverse direction (a unskewed, b skewed) never shows the skew at all. `rotation` is handled for exactly this reason (lines 129-135), but `transform`, the other field `framedBounds`/`poseFrameOf` read as geometry, is not. ROTATED_POSE_DESCRIPTOR and AUTO_POSE_DESCRIPTOR share this lerp. It should interpolate the four linear entries, or at least land on b's transform at t = 1.
- evidence: read
- severity: medium

## pathPoseDescriptor's polygon axes `to`/`write` emit the pose's own coord count, not the axes' `count`, overrunning the next row when a polygon's point count changes mid-flight
- where: packages/core/src/core/geometry/pathPoseDescriptor.ts:73-87 (pathPoseDescriptor.axes, polygon branch)
- scenario: a polygon node is animating (its scenePoseTarget is active, so `scenePoseTarget` returns the held target with `count = like.coords.length`, e.g. 8). A vertex is added to the polygon while it is in flight (10 coords). `liveAxes` keeps the old axes because `next.count !== count`, and the old `write(p, out, at)` loops `world.length` (10) times into `out[at..at+9]`, writing 2 numbers into the neighboring row of the target table (laid out `row * axes`); `to(p)` likewise returns 10 numbers for an 8-axis target. Should write/read at most `count` entries (or reject a pose of another shape, as the rect branch returns `[]`/no-op for a non-rect).
- evidence: read
- severity: low

## pathPoseDescriptor polygon `lerp` and `axes.add` take every non-coordinate field from one side, so a polygon whose commands differ never reaches b
- where: packages/core/src/core/geometry/pathPoseDescriptor.ts:42-50 (lerp), :77-82 (axes.add)
- scenario: a and b are polygons with the same number of coords but different `commands` (e.g. an `M L L L Z` square vs an `M L M L` pair of separate segments, 8 coords each). `lerp` checks only `coords.length` and keeps `...a` (commands, fillRule, origin), so `lerp(a, b, 1)` draws a's topology with b's points, not b. `axes.add(p, d)` rebuilds from `like` instead of `p`, so p's own commands/corners are replaced by `like`'s whenever the two differ. Should require matching commands (else throw, as it does for mixed kinds) and build from `p`.
- evidence: read
- severity: low

## rotatedRectContainsPoint / rotatedRectCorners ignore the pose's `transform`, answering differently from poseFrameOf/targetCorners for the same pose
- where: packages/core/src/core/geometry/rotatedRect.ts:36-57 (rotatedRectCorners, rotatedRectContainsPoint)
- scenario: a RotatedPose carrying a skew `transform` (which `remapRotatedLeaf` in the same area writes onto rotated leaves after a non-uniform group resize) is hit-tested with the exported `rotatedRectContainsPoint`: it inverts only `rotation`, so a point inside the drawn parallelogram but outside the turned box misses, and a point in the turned box but outside the ink hits. `targetCorners(b, targetTransformOf(b))` for the same pose returns the transformed corners. Also a pose with a negative width/height (the flip `positiveBox` documents a resize leaves) never contains any point, since `local.x >= x && local.x <= x + width` is unsatisfiable. Both are public exports (`barrel/interactions.ts:27`).
- evidence: read
- severity: low

## AUTO_POSE_DESCRIPTOR.axes treats a `{kind:'rect'}` Path as a rotatable rect pose while the rest of the descriptor says Paths cannot rotate
- where: packages/core/src/core/geometry/autoPoseDescriptor.ts:47-49 (AUTO_POSE_DESCRIPTOR.axes)
- scenario: `isRectPose` is checked before `isPathLike`, and a RectPath has numeric x/y/width/height, so a RectPath gets RECT_POSE_DESCRIPTOR's 5-axis mapping with a `rotation` angle axis. An additive animation with a nonzero rotation delta (`add`) or a `from` with a[4] ≠ 0 writes a `rotation` field onto the Path, which `getRotation` (returns 0 for paths), `supportsRotation` (false) and `withRotation` (no-op) all refuse, and which `pathPoseDescriptor.remapBounds`/`translate` then drop. Every other method dispatches Path-first; `axes` should too (pathPoseDescriptor's 4-axis rect mapping).
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

<!-- done: 5 findings, files read: 12 -->
