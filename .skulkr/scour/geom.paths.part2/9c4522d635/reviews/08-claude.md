## pathToD writes data that SVG and pathFromD drop whole when a subpath opens without an `M`
- where: packages/geom/src/paths/pathToD.ts:27 (pathToD)
- scenario: a PolygonPath whose first command is a drawing command (`[PATH_L, PATH_L]`), which `forEachSegment` reads as a subpath opened at the pen (0, 0) → `pathToD` emits `L10 0L10 10` with no leading moveto; SVG renders nothing for data that does not begin with `M`, and `pathFromD` builds an empty path (`strayPathDataHead`/`!started`). It should emit the implied `M` at the pen first. The pen is also read two ways: `pathToD` and `pathToCubicContours` read `worldCoords`, so for a path with an `origin` the implied start is world (0, 0), while `pathSignedArea`/`reversePath` (winding.ts) read raw coords, where the same implied start is the origin.
- evidence: read (commands.ts forEachSegment: "a drawing command no `M` precedes at all" opens a subpath)
- severity: low
- fix: packages/geom/src/paths/pathToD.ts
- size: function
- cause: implicit subpath start not written out
- confidence: likely

## reachToMeet ignores crossings with the end's own last segment
- where: packages/geom/src/paths/reachPath.ts:42 (segmentsBesideEnd)
- scenario: an open path whose last segment is a cubic hooked so its end's extension (tangent, circle of curvature, or eased spiral) runs back across that same segment, e.g. a curvature-mode reach on a curled end, where the circle of curvature follows the last segment back around → the whole end segment is dropped from the candidate strokes, so the first real crossing is missed and the end reaches past it to a further stroke, or returns null. The touch at the end itself, the reason for dropping the segment, is already handled by the `touching` threshold in `reachToMeet`.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/reachPath.ts
- size: line
- cause: whole segment excluded instead of only its touch at d≈0
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

<!-- done: 2 findings, files read: 38 -->
