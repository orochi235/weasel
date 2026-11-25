# Findings: geom.paths.part2 (round 49)

## joinPaths measures every part from the first part's origin, so a far part joined after a near one loses its float32 precision
- where: packages/geom/src/paths/pathOrigin.ts:82 (joinPaths)
- scenario: `joinPaths([nearPath /* no origin, coords near 0 */, farPath /* origin {x: 1e6, y: 1e6} */])` → the far part is written by `coordsFrom(undefined, worldCoords(farPath))` as raw float32 world coordinates around 1e6, where a float32 step is 1/16 unit; its curves snap to a 0.0625 grid. The joined path should pick an origin for the combined coordinates (as `originFor` / `autoOrigin` do) rather than inherit `parts[0]`'s, which may be none.
- evidence: read
- severity: medium

## simplifyAnchorsAt rotates a closed subpath so it starts on a different anchor
- where: packages/geom/src/paths/simplifyAnchors.ts:37-56 (simplifyAnchorsAt)
- scenario: closed subpath [A0..A7], selection {A0, A1, A2, A3} (not the whole subpath). `shift` = 4, `order` = [A4..A7, A0..A3], the run is thinned, and `set.anchors[s] = out` stores the subpath in rotated order: it now starts at A4. The doc promises that anchors outside a run are left as they were, but the start anchor (which the user can set on purpose with `setSubpathStart`, and which decides dash phase, tween start and flat indices) moves silently. `out` should be rotated back by `shift` before it is stored.
- evidence: read
- severity: medium

## splitByClosure gives corner specs to the wrong anchors after a subpath that starts without an M
- where: packages/geom/src/paths/splitByClosure.ts:31-33 (splitByClosure)
- scenario: `M0 0 L10 0 L10 10 Z L5 5 L0 10 Z` with a corner spec on the `L5 5` anchor. The source path counts 5 anchors (indices 0..4; the drawing after Z has no anchor for its implied start). `splitSubpaths` adds an `M` to the second subpath, so `countPathAnchors(sub)` reads 3 for it, where the source has 2. `anchorRange(3, 3)` then maps the added M (at 0,0) to source anchor 3 (`L5 5`), and `L5 5` to anchor 4. Each corner lands one anchor early, and every later subpath's `first` is off by one more. `splitSubpaths` itself gets this right by giving the added M source -1; `splitByClosure` should count the same way.
- evidence: read
- severity: low

## solveSpiro forces the tangent at a point next to a coincident neighbor to +X
- where: packages/geom/src/paths/spiro.ts:90-91 (buildSystem), :106 (sides), :174-175 (residuals)
- scenario: spiro points `[A smooth, B smooth, B' smooth (same spot as B), C smooth]`, which happens when a point is dragged and anchor-snapped onto its neighbor. The B→B' segment is under 1e-9 long, so it is marked straight, and its side angle is `atan2(0, 0) = 0`. At B and B', `followsLine` holds, so the curves A→B and B'→C are forced to arrive at and leave along +X whatever direction the points lie in, which puts a visible kink in the curve. A zero-length segment has no direction to follow: it should be skipped, or treated as a corner, not as a line heading along +X.
- evidence: read
- severity: medium

## schneiderFit breaks the tangent at every split, so a fitted pencil stroke has a corner at each joint
- where: packages/geom/src/paths/schneiderFit.ts:62-66 (fitRecursive), :97-105 (fitOneCubic)
- scenario: any freehand stroke that needs more than one cubic (`insert.ts` pencil, `bendAlongPath`). After a split at sample `w`, the left half ends on tangent `unit(s[w-1] - s[w])` and the right half starts on `unit(s[w+1] - s[w])`. These are opposite only when the three samples are collinear, so the joint is a corner: on a curved stroke sampled at 5 px steps, the turn at each sample shows up as a kink of the same angle. Schneider's method gives both halves the center tangent `unit(s[w+1] - s[w-1])` at the split. `fitRun.fitGreedy`, the refit that `simplifyPath` and `warpPath` share, already does this (`tIn = tangentAt(pts, lo)`), so the two fitters answer the same question two ways. Repeated pointer samples make it worse: `unit(s[1] - s[0])` of a duplicate is `{0, 0}`, which pins that handle onto its anchor.
- evidence: read
- severity: medium

## roundRectPath with cornerSamples 0, and circlePath with segments 0, build NaN or empty geometry
- where: packages/geom/src/paths/markers.ts:89-90 (roundRectPath), :18-31 (circlePath)
- scenario: `roundRectPath(0, 0, 10, 10, 2, 0)` gives `theta = start + (0 / 0) * HALF_PI = NaN`, so every coordinate is NaN. `circlePath(0, 0, 5, 0)` writes `PATH_M` and then `PATH_Z` into the same one-element command array, giving a path that is a bare `Z` with no coordinates. A count below what the builder can draw should be clamped (to 1 corner sample, or 3 circle segments) or rejected.
- evidence: read
- severity: low

## mergeRegion can leave a ring open where three edges cross at one point, and emit then closes it with a chord
- where: packages/geom/src/paths/mergeRegion.ts:54-56 (crossingPoint per pair), :232 (cutSegment skips a cut within 1e-9 of the last), :320-344 (chain), :355 (emit closes)
- scenario: three contours whose edges a, b and c all cross at one interior point, as in overlapping shapes rotated about a shared center. The pairs (a,b) and (a,c) each get their own crossing point, the midpoint of the two curves' estimates. These are a few ulps apart and lie outside `snap` of any end, so they are not merged. `cutSegment` on `a` keeps the first and drops the second as `cut.t - from < 1e-9`. `c`'s piece then ends at a point no other piece starts from. `chain` stops there, and `emit`'s `b.close()` draws a straight chord back to the ring's start, which adds or removes a sliver of fill. Cut points near one another on a segment should be merged to one point that every segment involved uses. (Inferred from the code; not run.)
- evidence: read
- severity: medium

## Files read
packages/geom/src/paths/markers.ts
packages/geom/src/paths/mergeRegion.ts
packages/geom/src/paths/nearestAnchor.ts
packages/geom/src/paths/pathAt.ts
packages/geom/src/paths/pathAwayFromAnchors.ts
packages/geom/src/paths/pathDistance.ts
packages/geom/src/paths/pathEndExtension.ts
packages/geom/src/paths/pathFromD.ts
packages/geom/src/paths/pathInWorld.ts
packages/geom/src/paths/pathMeasure.ts
packages/geom/src/paths/pathOrigin.ts
packages/geom/src/paths/pathStructure.ts
packages/geom/src/paths/pathToD.ts
packages/geom/src/paths/poiseHandles.ts
packages/geom/src/paths/puckerBloatPath.ts
packages/geom/src/paths/reachPath.ts
packages/geom/src/paths/repeatAlongPath.ts
packages/geom/src/paths/resamplePath.ts
packages/geom/src/paths/roughenPath.ts
packages/geom/src/paths/schneiderFit.ts
packages/geom/src/paths/segmentLength.ts
packages/geom/src/paths/segmentType.ts
packages/geom/src/paths/simplifyAnchors.ts
packages/geom/src/paths/simplifyPath.ts
packages/geom/src/paths/snipPath.ts
packages/geom/src/paths/spanFit.ts
packages/geom/src/paths/spiro.ts
packages/geom/src/paths/spiroPath.ts
packages/geom/src/paths/splitByClosure.ts
packages/geom/src/paths/splitSubpaths.ts
packages/geom/src/paths/transform.ts
packages/geom/src/paths/transformPath.ts
packages/geom/src/paths/tugPathEnd.ts
packages/geom/src/paths/tweenPaths.ts
packages/geom/src/paths/winding.ts
packages/geom/src/paths/zigzagPath.ts

<!-- done: 7 findings, files read: 36 -->
