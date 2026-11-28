## pathToD writes no moveto for a subpath that opens without one, so its output draws nothing
- where: packages/geom/src/paths/pathToD.ts:28 (pathToD)
- scenario: a `PolygonPath` whose command stream starts with a drawing command (`[PATH_L, PATH_L]`, coords `[10,0, 10,10]`). `forEachSegment` and every other reader in geom treat it as a subpath opened at the pen, stored (0, 0), which is `origin` in the path's own space. pathToD emits `L10 0L10 10`. SVG data that does not open with a moveto is in error and renders nothing, and `pathFromD` of that string returns an empty path. The round trip loses the whole path. Expected: an `M` at the implied pen, i.e. `M{origin.x} {origin.y}` (0 0 when the path has no origin), before the first drawing command. `PathBuilder` always emits the `M`, so only paths built from raw command arrays reach this.
- evidence: read (commands.ts `forEachSegment` "a drawing command no `M` precedes at all" opens at the pen; pathToD walks commands with no pen tracking)
- severity: low
- fix: packages/geom/src/paths/pathToD.ts
- size: line
- cause: implicit subpath opening not lowered
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

<!-- done: 1 findings, files read: 38 -->
