# Findings: geom.paths.part2

## An out-of-range number in non-arc path data is dropped and the arguments after it slide into its slot
- where: packages/geom/src/paths/pathData.ts:63 (readNumbers)
- scenario: `pathFromD('M0 0 L1e400 5 10 10')` → `readNumbers` skips `1e400` (Infinity) and returns `[5, 10, 10]`, so `pathFromD` draws `L5 10` and then stops at the odd argument. Every coordinate after the bad number moves one slot over, so the path is drawn with wrong geometry instead of stopping where the error is. `readArcArgs` already ends the run at such a number; `readNumbers` should do the same (stop, not skip), so the command counts as short and the path ends before it, as SVG does.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathData.ts
- size: line
- cause: skip instead of stop on a non-finite token
- confidence: sure

## `pointAlongPath` with `t = NaN` returns a NaN station instead of a clamped one
- where: packages/geom/src/paths/pathAt.ts:33 (pointAlongPath)
- scenario: `Math.min(Math.max(NaN, 0), 1)` is NaN, so `measure.at(NaN)` runs. In `at`, `target` is NaN too, `segmentAt` falls back to segment 0, and `pointOnSegmentOnly` is evaluated at NaN, giving `{x: NaN, y: NaN}`. The doc says `t` is clamped to 0..1. A NaN fraction can come from a 0/0 ratio upstream, such as a zero-length drag. The same gap exists in `PathMeasure.at`'s own clamp (pathMeasure.ts:146).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathAt.ts, packages/geom/src/paths/pathMeasure.ts
- size: line
- cause: Math.min/Math.max let NaN through
- confidence: sure

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

<!-- done: 2 findings, files read: 38 -->
