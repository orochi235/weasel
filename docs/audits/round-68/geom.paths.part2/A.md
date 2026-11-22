# Findings: geom.paths.part2

## `mergeRegion` throws when a long straight edge has a short, slightly tilted one lying along it
- where: packages/geom/src/paths/mergeRegion.ts:101-105 (overlapCuts)
- scenario: two straight edges, `a` = (0,0)→(1000,0) and `b` = (10,0)→(20,0.000009), at the default tolerance 0.01 (snap 1e-5). `endsAlong(a, b, snap)` finds both of `b`'s ends within snap of `a`'s line, so `onA` is non-null. `endsAlong(b, a, snap)` measures `a`'s far end against `b`'s line, about 8.9e-4 off, which is past snap, so it returns null. The `!` is only a type assertion, so `cuts[j]!.push(...onB)` spreads `null` and throws `TypeError: Spread syntax requires ...iterable`. The collinearity test is not symmetric: it is measured against whichever line is the reference, and a short edge's line extrapolated over a long edge's length strays by the tilt times that length. Float32 coordinates on abutting shapes produce tilts this small. Expected: the shared stretch is cut on both edges, or on neither.
- evidence: read
- severity: high

## `pathFromD` ignores numbers after `Z` and keeps drawing, where SVG stops at the error
- where: packages/geom/src/paths/pathFromD.ts:160 (pathFromD)
- scenario: `"M0 0 L10 0 L10 10 Z 5 5 L20 20"` → the tokenizer gives `Z` the args `[5, 5]`. The `Z` branch closes the path and `continue`s without checking `args.length`, so the later `L20 20` is drawn. SVG treats numbers after a closepath as an error and renders nothing past it. That is the rule this function applies to every other command with the wrong argument count (line 179), and the one its doc states.
- evidence: read
- severity: low

## `simplifyAnchorsAt` deletes every anchor of a closed one-anchor subpath and leaves an empty subpath in the set
- where: packages/geom/src/paths/simplifyAnchors.ts:31-33 (simplifyAnchorsAt), via packages/geom/src/paths/simplifyPath.ts:65 (simplifySubpath)
- scenario: an `AnchorSet` with a closed subpath of one anchor (`M x y Z`), with that anchor named. `named.size === sub.length`, so `simplifySubpath(sub, true, …)` runs. `isCorner` marks the anchor a corner (both directions are zero, so the dot product 0 is below cos 40°). `fitStops` then samples the run 0→1, which dedupes to one point, and skips it as `pts.length < 2`, so the function returns `[]`. `0 < 1` passes, so `set.anchors[s] = []` and the call reports a change. The same happens for a closed subpath whose anchors all coincide. The doc promises "a run's first and last anchors stay"; instead the anchor is gone, and an empty subpath stays in the set for `locateAnchor` and flat indexing to trip over. Expected: the subpath is left as it was.
- evidence: read
- severity: low

## `simplifyPath` drops lone-anchor subpaths, though its doc says open ends stay
- where: packages/geom/src/paths/simplifyPath.ts:39 (simplifyPath)
- scenario: a path `M0 0 L10 0 L10 10 M50 50` (the second subpath is a bare moveto, which `pathToAnchors` keeps as a one-anchor subpath). `if (sub.length < 2) return;` skips it without pushing it to `out`, so the result has one subpath and the anchor at (50,50) is gone. The doc says "the ends of open subpaths stay where they are". `simplifyAnchorsAt` and `resamplePath` (resamplePath.ts:60, which pushes `sub` through unchanged) keep such a subpath, so the same input gets two answers. Flat anchor indexes after it also shift by one.
- evidence: read
- severity: low

## `roughenPath` gives two contours the same offsets once a contour has more than 65,536 samples
- where: packages/geom/src/paths/roughenPath.ts:51-52 (roughenPath)
- scenario: the hash index is `r * 65536 + i`, but `detail` is capped at 1000 (`countParam`), so a contour holds up to `segments × 1001` samples. With `detail: 1000` on a path whose first contour has 70 segments (70,070 samples), sample `i = 65,536 + k` of contour 0 hashes like sample `k` of contour 1. The two contours then roughen with identical, visibly correlated jitter instead of independent jitter.
- evidence: read
- severity: low

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
packages/geom/src/paths/samePolygon.ts
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

<!-- done: 5 findings, files read: 37 -->
