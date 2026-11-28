## mergeRegion's welder can send the same point to two different welded points, so a contour's last end and first start can come apart
- where: packages/geom/src/paths/mergeRegion.ts:233 (welder), used by weld at :218 and the crossing points at :62
- scenario: the welder answers the first stored point within `snap` that it meets while walking the 3×3 cells in a fixed order. It does not answer the first point stored. A contour's start S is welded once, at its first segment, onto A. Later, B is stored: B is more than `snap` from A but within `snap` of S (A and B can be up to 2·snap apart). When the contour's last segment ends at S, the welder can meet B's cell before A's and send S to B. The first segment then starts at A and the last ends at B, so the ring no longer closes. `flattenAll` splits it into separate open rings, which throws off the winding counts, and `chain` leaves a gap that `emit` closes with a stray edge. This needs contours with near-coincident corners, which is exactly the case welding is there for.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/mergeRegion.ts
- size: function
- cause: welds to the first match in cell order, not the first point stored (or the nearest), and keeps no memo per input point
- confidence: likely

## roundRectPath writes duplicate consecutive points when the radius is half a side (pill shapes)
- where: packages/geom/src/paths/markers.ts:79 (roundRectPath)
- scenario: `roundRectPath(0, 0, 40, 20, 10)` clamps the radius to 10 = height/2. The right corners' arcs then end and start at the same point (x+w, y+r): the top-right arc's last sample and the bottom-right arc's first sample. The path gets a zero-length `L` at each side that has no straight run. A stroked pill marker then has degenerate segments, where join and miter math has no direction to work from. The answer should skip a corner's first sample when it equals the previous corner's last.
- evidence: read
- severity: low
- size: line
- cause: every corner emits both of its end samples, even when the straight run between corners has no length
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
