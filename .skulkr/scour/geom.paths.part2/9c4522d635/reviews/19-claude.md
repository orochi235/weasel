# Findings: geom.paths.part2

## pathFromD skips an unknown command letter and keeps drawing, so later relative commands start from the wrong point
- where: packages/geom/src/paths/pathFromD.ts:69 (pathFromD)
- scenario: `pathFromD('M0 0 L10 0 X5 5 l10 10')` drops `X` and its numbers, then draws `l10 10` from (10, 0). SVG treats an unknown command as an error and draws nothing past it, and this module already stops at a command with the wrong argument count for exactly that reason ("carrying on would start every later relative command from the wrong point"). One malformed-data case stops; the other carries on.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathFromD.ts
- size: line
- cause: unknown letter `continue`s instead of `break`ing
- confidence: sure

## resamplePath's 10,000-anchor cap on `spacing` counts pieces, not anchors
- where: packages/geom/src/paths/resamplePath.ts:121 (allocate)
- scenario: a path of many open subpaths with a small `spacing`: the check sums `span.pieces`, but each open subpath writes `pieces + 1` anchors, and one-anchor subpaths add their anchors too. A path of 2,000 open two-anchor subpaths at a spacing giving 5 pieces each sums to 10,000 pieces and passes, writing 12,000 anchors, past the cap the option documents ("A spacing that would place more than 10,000 anchors places 10,000"). The count branch does count fixed anchors (`fixedCount`), so the two branches answer the cap differently.
- evidence: read
- severity: low
- size: function
- cause: spacing branch compares piece total, not anchor total
- confidence: sure

## reachToMeet never meets the end's own segment, so an extension that curls back over it runs through
- where: packages/geom/src/paths/reachPath.ts:43 (segmentsBesideEnd)
- scenario: `reachToMeet(path, [], end, { mode: 'curvature' })` on an open arc whose last segment is a tight curve: the circle of curvature comes back round within one turn and crosses the end segment itself, but that segment is filtered out of the candidates wholesale (rather than only its touch at the end point, which `touching` already excludes), so the reach misses that crossing and runs on to a farther stroke or returns null.
- evidence: read
- severity: low
- size: function
- cause: whole end segment excluded instead of just its endpoint touch
- confidence: likely

## Files read
packages/geom/src/paths/markers.ts
packages/geom/src/paths/mergeRegion.ts
packages/geom/src/paths/nearestAnchor.ts
packages/geom/src/paths/pathAt.ts
packages/geom/src/paths/pathAwayFromAnchors.ts
packages/geom/src/paths/pathData.ts
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

<!-- done: 3 findings, files read: 38 -->

