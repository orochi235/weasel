## pathFromD skips an unknown command letter and carries on, while every other error in the data ends the path
- where: packages/geom/src/paths/pathFromD.ts:65 (pathFromD)
- scenario: `pathFromD('M0 0 L10 0 X 5 l10 10')` → the `X` run and its number are dropped and `l10 10` is drawn from (10,0). SVG treats an unknown command as an error and renders only up to it, which is how this same function already handles a wrong argument count or a missing moveto ("as SVG renders both"). Two answers to "the data is in error" in one parser, and the relative commands after the bad letter are drawn where no browser draws them.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathFromD.ts
- size: line
- cause: `continue` where the other error paths `break`
- confidence: sure

## A NaN tolerance turns resamplePath into a 64-way split of every piece, and simplifyPath into dropping straight segments
- where: packages/geom/src/paths/resamplePath.ts:55 (resamplePath); packages/geom/src/paths/simplifyPath.ts:105 (fitParams)
- scenario: `resamplePath(p, { tolerance: NaN })` (an unparsed field from a panel): `Math.max(NaN, 1e-6)` is NaN, so `worst(...) <= tol` and `err > tol` are both false. fitPiece never accepts the straight answer, never halves, and always emits a cubic, fine; but in simplifyPath the same NaN reaches `sampleRun`, where `Math.min(8, Math.max(1, Math.floor(len / (4 * NaN))))` is NaN and the `k <= steps` loop adds no samples for any straight segment, so straight runs fit as though their far anchors did not exist. Should fall back to the default the way a non-finite `count` does.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/resamplePath.ts, packages/geom/src/paths/simplifyPath.ts
- size: line
- cause: `Math.max` with NaN propagates NaN; no finiteness check
- confidence: sure

## simplifySpan over coincident anchors returns one anchor, so simplifyAnchorsAt deletes the run's last anchor
- where: packages/geom/src/paths/simplifyPath.ts:97 (simplifySpan); packages/geom/src/paths/simplifyAnchors.ts:47 (simplifyAnchorsAt)
- scenario: a run of three or more selected anchors that all sit on one point (stacked by a snap): every `sampleRun` dedupes to one point, `fitStops` adds nothing, and `result` is just the first anchor, with the last anchor's outHandle copied onto it. simplifyAnchorsAt sees `refit.length < end - start + 1` and splices, removing the run's last anchor, which the doc says always stays, and its inHandle is lost.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/simplifyPath.ts
- size: line
- cause: no guard that the refit still ends on the run's last anchor
- confidence: likely

## pointAlongPath with a NaN fraction answers a NaN point instead of a clamped station
- where: packages/geom/src/paths/pathAt.ts:33 (pointAlongPath)
- scenario: `pointAlongPath(p, NaN)`: `Math.min(Math.max(NaN, 0), 1)` is NaN, and `measure.at(NaN)` clamps with the same `Math.min/Math.max`, so the point is `{NaN, NaN}`. The doc says `t` is clamped to 0..1.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathAt.ts, packages/geom/src/paths/pathMeasure.ts
- size: line
- cause: Math.min/max do not clamp NaN
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

<!-- done: 4 findings, files read: 38 -->
