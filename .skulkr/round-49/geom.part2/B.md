# Audit round 49 — geom.part2 findings

## polygonIntersectsPath with `filled: false` counts the unstroked closing edge of an open subpath
- where: packages/geom/src/pathHitTest.ts:347 (polygonIntersectsPath)
- scenario: a polygon path with one open subpath of 3+ points (no `Z`) under the default `openFill: 'close'`, lasso-tested with `filled: false` (nothing paints the interior). `regionSubpaths` moves that open run among `closed`, so `anyEdgeCrossesPolygon(closed, …)` also tests the implicit edge from the last point back to the first. A lasso that crosses only that chord — which no stroke draws, and whose fill is off — reports a hit. With `filled: false` the outline should be the open run's own edges (`flatSubpaths(...).open` tested with `anyOpenEdgeCrossesPolygon`), independent of `openFill`.
- evidence: read
- severity: medium

## rotatePathAbout writes far-out world coords straight into float32, where transformPath gives them an origin
- where: packages/geom/src/poseRotation.ts:52-62 (rotatePolygon), :65-83 (rotateRectCorners); reached from packages/geom/src/poseFrame.ts:109-110 (pathThroughPoseFrame)
- scenario: a rect path `{x: 300000.3, y: 300000.3, width: 10, height: 10}` on a pose with `rotation: 0.3` and no `transform`. `pathThroughPoseFrame` takes the rotation-only branch, `rotateRectCorners` puts the rotated world corners into a `Float32Array` with no `origin`, so each lands on float32's 1/32 grid (fraction lost, up to ~0.03 units, more further out). The same pose with any non-identity `transform` goes through `transformPath`, whose rect promotion uses `PathBuilder().autoOrigin()` and whose polygon path calls `originFor`, keeping the doubles. An origin-free polygon in `rotatePolygon` has the same hole. Two answers to "rotate this path" that disagree far from the origin; picking/silhouettes of a rotated far node drift from what the renderer draws.
- evidence: read (poseRotation.ts, paths/transformPath.ts:21-75)
- severity: medium

## poseFrameInverseOf / poseRotationOf throw on a null or undefined pose that poseFrameOf accepts
- where: packages/geom/src/poseRotation.ts:27-28 (poseRotationOf), via packages/geom/src/poseFrame.ts:88 (poseFrameInverseOf)
- scenario: `poseFrameOf(null)` and `poseLinearOf(null)` return `null` (both guard `p` / use `?.`), and all take `pose: unknown`. `poseFrameInverseOf(null)` passes `poseLinearOf` then calls `poseRotationOf(null)`, which reads `p.rotation` on `null` → TypeError. Same for `pathThroughPoseFrame(path, undefined)`. Should return `null` / the path unchanged.
- evidence: read
- severity: low

## ringSignedArea loses the area's sign far from the origin
- where: packages/geom/src/polyline.ts:41-45 (ringSignedArea)
- scenario: the shoelace terms are `x_i·y_j − x_j·y_i` on absolute coords. A unit square at (1e8, 1e8) has terms ~1e16 whose rounding (~2 per term) exceeds the area (1), so the sign — which nesting (`tessellate/nesting.ts:23`) and the renderer's ring reversal (`batchClip.ts:140`, `batchHull.ts:173`) act on — can come out wrong; at 1e7 it is already off by a few percent. Measuring each vertex from the ring's first vertex keeps it exact to the ring's own size.
- evidence: read (arithmetic, not run)
- severity: low

## trackRun.nearest clamps the whole shape's nearest fraction into the run, where trackSlice searches the stretch
- where: packages/geom/src/track/run.ts:93 (trackRun → nearest)
- scenario: `trackRun(arcShape({center:{x:0,y:0}, radius:100, start:0, end:0}), 0, 0.25)` (a quarter of a whole circle, 12 → 3 o'clock). A probe at 11 o'clock, `(-50, -87)`: the whole circle's nearest is f ≈ 0.917; `clamp(0.917, 0, 0.25)` gives 0.25 (3 o'clock, ~173 px away) instead of the run's true nearest, f = 0 (12 o'clock, ~52 px away). The same happens on any non-convex path shape whose global nearest lies in a part outside the run. `trackSlice` (track/slice.ts:40-43) answers the same question correctly — "the whole shape's nearest point is off the stretch, which says nothing of where the stretch's own is" — with `nearestWithin`; the run should share it. The reported `distance` is also to the wrong point.
- evidence: read
- severity: medium

## tagTypedArrays leaves a class instance unwrapped that the replacer wraps, so `{__raw}`/`{__ta,data}`-shaped instances revive wrong
- where: packages/geom/src/typedArrayJson.ts:90 (misread), :93-95 (within), :113-118 (tagTypedArrays)
- scenario: `class Tag { __raw = 5 }`; `JSON.stringify(tagTypedArrays({ t: new Tag() }))` writes `{"t":{"__raw":5}}` (JSON writes an instance's own keys as a plain object), and `reviveTypedArrays(JSON.parse(...))` takes the wrapper off, giving `{ t: 5 }`. Likewise an instance with own `__ta: 'f32', data: [1, 2]` revives as a `Float32Array`. `misread` and `within` only consider `isPlain` objects, while `typedArrayReplacerWrapping` (line 141-142) deliberately wraps any non-array object "a class instance's included". Two writers of the same format disagree; the plain-copy writer corrupts such values (and leaves any typed array inside a class instance untagged, so it saves as an index-keyed object).
- evidence: read
- severity: low

## shiftTrack carries a closed shape past its seam at the seam's local ratio, so an open `at`/`nearest` past 1 lands off the shifted track's own length
- where: packages/geom/src/track/shift.ts:52-53 (toBase), :68-69 (fromBase), used by `at` (:75-76) and `nearest` (:83-88)
- scenario: `shiftTrack(ellipseShape({center, radiusX: 100, radiusY: 50, start: 0, end: 0}), 20)` — a closed ellipse shifted outward. `at(1.5, {open: true})` should be the station half the shifted track's own length past the seam (by symmetry, base fraction 0.5). `toBase(1.5)` instead extrapolates linearly with `endRatio`, the base/shifted ratio of the last sample only (~1/1.1 at the flat 12 o'clock seam), giving base ≈ 1 + 0.5·610/(1.1·484) ≈ 1.573 → base fraction 0.573 after the wrap: ~35 units along from the true spot. `fromBase` mirrors it, so an open `nearest` past the seam reports the matching wrong `f`. A closed base shape wraps round itself (`TrackAtOptions.open`: "a closed path round its contour"), so for `shape.closed` the excess laps should go through the table (`floor(f)` laps + the table lookup), not the end ratio. Reached by `runPlaceAt(..., 'follow')` and `placeAlongRun({past: 'follow'|'hold'})` without `wrap` on a run over a shifted closed track.
- evidence: read (arithmetic, not run)
- severity: low

## Quadrant snap targets are centered on the control-point box, not the subpath's box
- where: packages/geom/src/snap/pathSnap.ts:158-161 (quadrantPoints)
- scenario: `PathSegment.box` is "the axis-aligned box of the control points" (intersect/pathSegments.ts:19). For a closed dome `M0 0 C0 -100 100 -100 100 0 Z`, the control box's top is y = -100 while the curve's own top is y = -75, so `cy` is -50 instead of -37.5 and the left/right "compass points" (and any vertical-line crossing on an asymmetric curve) snap 12.5 units off where the shape's box center puts them. A circle made of the usual four cubics hides it because its controls lie on the tight box. The kind is documented as crossings of "the horizontal and vertical lines through the center of its box"; the box should be the curve's tight bounds (extrema, which `segmentExtremaT` already finds).
- evidence: read
- severity: low

## The paths guide documents nearestOnPath's result as `dist` and the hit tests' option as `tolerance`; the code has `distance` and `flattenTolerance`
- where: packages/geom/src/nearest.ts:18 (CurveNearest.distance), packages/geom/src/pathHitTest.ts:29 (PathHitTestOptions.flattenTolerance); docs at packages/geom/docs/guides/paths.md:334 and :292
- scenario: following the guide, `nearestOnPath(triangle.commands, triangle.coords, 50, -10).dist` is `undefined` (the field is `distance`), and "Both take a `tolerance` option" — `pathContainsPoint(p, x, y, { tolerance: 0.1 })` is a type error in TS and silently uses the default 0.5 from JS. The example's other fields (`x: 50, y: 0, t: 0.5, commandIndex: 1, coordIndex: 2`) do match.
- evidence: read
- severity: low

## ellipseShape turns `start: 0, end: 360` into a zero-length or not-quite-closed track, where arcShape and trackShapeD call it whole
- where: packages/geom/src/track/ellipse.ts:142-145 (ellipseShape: `param`, `raw`, `sweep`)
- scenario: `ellipseShape({center, radiusX: 100, radiusY: 50, start: 0, end: 360, direction: 'ccw'})`. `param(360)` goes through `Math.sin(2π) = -2.45e-16`, so it is ≈ -1.4e-14° rather than 0; with `sign = -1`, `raw = wrapPositive(+1.4e-14, 360)` is 1.4e-14, not 0, so `sweep` is 1.4e-14°, `length` ≈ 0 and `closed` false: every `at(f)` returns the start point. Clockwise, the same rounding gives `raw` = 360 − ulp (not 0) once `radiusY/radiusX` exceeds ~2, so the whole ellipse reports `closed: false`. The same spec on `arcShape` is a whole circle (`wrapPositive(-360, 360)` is exactly 0), and `trackShapeD` (pathData.ts:43) treats `(start - end) % 360 === 0` as whole and draws a full ellipse over a track that is a point. The closed test should compare the spec's directions (`wrapPositive(end - start, 360) === 0`) before mapping to the parameter, as the arc does.
- evidence: read (arithmetic on JS `Math.sin(2*Math.PI)`, not run)
- severity: medium

## pbt fixture `coord` promises no `-0` but its range includes it
- where: packages/geom/src/pbt.fixture.ts:10-13 (coord)
- scenario: `fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true })` spans zero, and fast-check's double arbitrary draws `-0` inside such a range (it biases toward special values). A property that compares a `coord()` value with `toBe` after a transform that turns `-0` into `0` (or the reverse) fails on a shrink to `-0`, which the comment says callers need not worry about. Mapping `(v) => v + 0` would make the claim true.
- evidence: inference (fast-check behavior not run here)
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

<!-- done: 11 findings, files read: 41 -->
