# Audit round 49 — geom.part2 findings

## poseFrameInverseOf / pathThroughPoseFrame throw on a null or undefined pose, where poseFrameOf answers null
- where: packages/geom/src/poseRotation.ts:27 (poseRotationOf), reached from packages/geom/src/poseFrame.ts:88 (poseFrameInverseOf) and :109 (pathThroughPoseFrame)
- scenario: `poseFrameOf(undefined)` and `poseLinearOf(undefined)` both guard (`!p` / optional chaining) and answer null, but `poseRotationOf` reads `p.rotation` with no guard. So `poseFrameInverseOf(undefined)` → `poseLinearOf` null → `poseRotationOf(undefined)` → TypeError "Cannot read properties of undefined (reading 'rotation')"; likewise `pathThroughPoseFrame(path, null)`. All three take `pose: unknown` and the frame/inverse pair should agree: inverse of "no frame" is "no frame" (null), not a throw.
- evidence: read
- severity: low

## stepLine with step 0 (or a non-finite step) answers a line of NaN direction
- where: packages/geom/src/snap/stepLine.ts:18 (stepLine)
- scenario: a constrain request `{ step: 0 }` (core `inputSubspace.ts:29` passes `c.step` straight through; kernel3d `snap/plane.ts:31` likewise) → `Math.round(atan2/0) * 0` = `±Infinity * 0` = NaN → `cos/sin(NaN)` → `dirs: [[NaN, NaN]]`. `orthonormalize` then drops the direction, so the input flat collapses to the point `about` and the constrained drag freezes in place instead of moving freely (or along the raw direction). A zero/invalid step should fall back to the unrounded direction.
- evidence: read
- severity: low

## tagTypedArrays and typedArrayReplacer disagree on a class instance shaped like a tag or a wrapper
- where: packages/geom/src/typedArrayJson.ts:90 (misread) vs :142 (typedArrayReplacerWrapping)
- scenario: the replacer wraps any non-array object whose own keys read back as a tagged array or `{__raw}` ("a class instance's included", its comment says), because `JSON.stringify` writes a class instance as a plain object. `tagTypedArrays` only wraps when `isPlain(value)`. So `JSON.stringify(tagTypedArrays({ v: new Box() }))` where `Box` instances have own keys `{ __raw: 1 }` (or `{ __ta: 'f32', data: [1] }`) writes `{"v":{"__raw":1}}`, and `reviveTypedArrays` unwraps it to `1` (or revives a `Float32Array`), while the replacer path round-trips it. One question answered two ways by the two writers the module offers as equivalent ("`tagTypedArrays` as a `JSON.stringify` replacer").
- evidence: read
- severity: low

## trackRun.nearest clamps the whole shape's nearest fraction into the run, so a point past one end of a sub-run snaps to the wrong end
- where: packages/geom/src/track/run.ts:93 (trackRun → nearest)
- scenario: `trackRun(arcShape({ center, radius: 50, start: 0, end: 270 }), 0, 0.5)` (rowRun in `ui/Along/rowRun.ts` builds runs on sub-ranges like this). A point at 265° has `shape.nearest(p).f ≈ 0.98`; `clamp(0.98, 0, 0.5)` gives 0.5 (135°, 130° away), while the run's real nearest spot is its start at 0° (95° away). Same on a closed circle: run 0.1..0.4, point at f = 0.95 → clamped to 0.4 though 0.1 is far closer across the seam. The returned `distance` is then to the wrong end, and a control dragged past the start jumps to the far end. `trackSlice` (`track/slice.ts:40-43`) answers the identical question correctly — its comment: "The whole shape's nearest point is off the stretch, which says nothing of where the stretch's own is" — and searches within `lo..hi` instead; `arcShape.nearest` (`arc.ts:51`) also picks the nearer end by angle. Two answers to one question.
- evidence: read
- severity: medium

## Quadrant snap targets are placed from the control-point box, not the curve's box, so they miss on any curve whose handles overshoot it
- where: packages/geom/src/snap/pathSnap.ts:158-161 (quadrantPoints)
- scenario: `PathSegment.box` is "Axis-aligned box of the control points" (`intersect/pathSegments.ts:19`). The doc promises points "where a closed subpath crosses the horizontal and vertical lines through the center of its box". For a circle drawn as four 0.5523-handle cubics the hull box equals the tight box, which is why the circle case works; for a closed path `M 0 0 C 0 -200 100 0 100 0 Z` the hull's y-range is -200..0 (center -100) while the curve only reaches y ≈ -88.9, so the horizontal line at y = -100 never meets the curve and those quadrant points are missing, and the vertical one sits off the true center. Any ellipse rotated off-axis, a teardrop, or a pen-drawn blob gives off-center or missing quadrant points. Should use the segments' tight bounds (curve extrema) for x0..y1.
- evidence: read
- severity: low

## polygonIntersectsPath with `filled: false` still counts the phantom closing chord of an open subpath
- where: packages/geom/src/pathHitTest.ts:347-352 (polygonIntersectsPath)
- scenario: the outline is taken from `regionSubpaths`, which (under the default `openFill: 'close'`) moves every open run of ≥ 3 points into `closed`. `anyEdgeCrossesPolygon(closed, …)` then walks each closed run's wrap-around edge too. With `filled: false` nothing paints the interior and a stroke never draws an open subpath's closing edge, yet that chord is tested. Concretely: an unfilled open "C"-shaped arc (core `regionHit.ts:173` calls exactly this for an unfilled node); a lasso drawn as a thin polygon across the C's mouth, touching no drawn stroke and containing none of its vertices, crosses the chord → `true`, so the shape is selected by a lasso that never touched it. For `filled: false` the open runs should come from `flatSubpaths(...).open` and go through `anyOpenEdgeCrossesPolygon`.
- evidence: read
- severity: medium

## rotatePathAbout writes rotated coords far from the origin straight into Float32, where transformPath gives them an origin
- where: packages/geom/src/poseRotation.ts:65-82 (rotateRectCorners) and :52-62 (rotatePolygon, no-origin branch)
- scenario: a rect node at x = 300,000 with `rotation: 0.3` goes through `pathThroughPoseFrame` → `rotatePathAbout` → `rotateRectCorners`, which puts the four doubles into a bare `Float32Array` with no `origin`: at 300k a float32 sits on a 1/32 grid, so each corner moves by up to 1/64 unit (1/16 at 1e6), and the silhouette, culling bounds and picking `poseFrame.ts` says must agree on "where the node is" disagree with the painter. The same pose with any `transform` takes `transformPath`, which for a rect promotes through `PathBuilder().autoOrigin()` and for a polygon measures from an origin past `ORIGIN_THRESHOLD` (16,384, `paths/pathOrigin.ts:61`), so it keeps the fraction. `rotatePolygon` likewise only routes through `transformPath` when the input already has an origin; a no-origin polygon rotated to past the threshold is rounded the same way. One rotation, two precisions depending on whether a skew is present.
- evidence: read
- severity: low

## Files read
packages/geom/src/nearest.ts
packages/geom/src/niceStep.ts
packages/geom/src/openFill.ts
packages/geom/src/outlineSegments.ts
packages/geom/src/outputGrid.ts
packages/geom/src/path.ts
packages/geom/src/pathHitTest.ts
packages/geom/src/pathSubpaths.ts
packages/geom/src/pbt.fixture.ts
packages/geom/src/place.ts
packages/geom/src/points.ts
packages/geom/src/points2.ts
packages/geom/src/polyRoots.ts
packages/geom/src/polyline.ts
packages/geom/src/portCurve.ts
packages/geom/src/portCurve2.ts
packages/geom/src/poseFrame.ts
packages/geom/src/poseRotation.ts
packages/geom/src/pxExtent.ts
packages/geom/src/scalar.ts
packages/geom/src/screenBand.ts
packages/geom/src/snap/flat.ts
packages/geom/src/snap/pathSnap.ts
packages/geom/src/snap/resolve.ts
packages/geom/src/snap/segmentFeatures.ts
packages/geom/src/snap/stepLine.ts
packages/geom/src/spline/catmullRom.ts
packages/geom/src/spline/interpolation.ts
packages/geom/src/spline/monotone.ts
packages/geom/src/track/arc.ts
packages/geom/src/track/ellipse.ts
packages/geom/src/track/path.ts
packages/geom/src/track/pathData.ts
packages/geom/src/track/place.ts
packages/geom/src/track/run.ts
packages/geom/src/track/shape.ts
packages/geom/src/track/shift.ts
packages/geom/src/track/slice.ts
packages/geom/src/typedArrayJson.ts
packages/geom/src/view.ts
packages/geom/src/viewToMat3.ts

<!-- done: 7 findings, files read: 41 -->
