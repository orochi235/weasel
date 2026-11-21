# Audit round 65 — geom.paths.part2 findings

## mergeRegion leaves a gap mid-contour where two or more consecutive sub-`snap` straight edges are dropped, and the merged output gains chords across the shape
- where: packages/geom/src/paths/mergeRegion.ts:161 (closeContour)
- scenario: `closeContour` first drops every straight edge no longer than `snap` (tol·1e-3), then repairs each resulting gap only when it is itself ≤ `snap` (moving the next start back); a gap larger than `snap` is bridged only at `i === 0`. Two consecutive near-duplicate vertices — e.g. edges of 0.8·snap each, which float32 rounding from a boolean or offset leaves at magnitudes ~100 with the default tolerance 0.01 (snap 1e-5) — leave a gap of up to 1.6·snap at some `i > 0` that nothing closes. `weld` cannot fix it either (the two ends are more than `snap` apart). When anything else in the path needs cutting (`changed` true), `chain` stops at the gap, so the contour comes out as two rings, each closed by `emit`'s `close()` with a straight chord from the gap back to its ring start: the outline acquires edges running across the interior. Should: bridge (or move onto one point) every gap the filter opens, not only the one at index 0.
- evidence: read
- severity: medium

## snipPathAt removes two pieces when the probe's nearest point is exactly a crossing, and a closed subpath crossed once comes back in `removed` drawn twice
- where: packages/geom/src/paths/snipPath.ts:84 (snipPathAt)
- scenario: `below`/`above` use strict `<`/`>` against `found.at`. When the cutter passes exactly through an anchor of the path (a snapped T-junction) and the probe sits outside that corner, `nearestOnSeg` answers the anchor (`at = k` exactly), and the crossing stop there is also exactly `k`. It lands in neither list, so on an open subpath `lo..hi` runs from the previous stop to the next one — the pieces on both sides of the junction go, not the one probed. On a closed subpath with that single stop, `lo = k − n` and `hi = k + n`, so `stretch` walks 2n segments and `removed` traces the whole loop twice. Should: assign a stop equal to `found.at` to one side (e.g. `<=` for `below`), so one piece of length at most one turn is removed.
- evidence: read
- severity: low

## roughenPath's seed is truncated to an int32, so fractional seeds all roughen the same way
- where: packages/geom/src/paths/roughenPath.ts:22 (hash01)
- scenario: `hash01` mixes `seed | 0`. A caller passing `seed: Math.random()` (or any value in 0..1, or two seeds differing only in their fraction, or seeds past 2^31 that wrap onto others) gets the offsets of seed 0 every time; the option is silently dropped, while `RoughenPathOptions.seed` says only "Picks the offsets". Should: hash the seed's full double (e.g. both 32-bit halves of its bits) or document and validate whole-number seeds.
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

<!-- done: 3 findings, files read: 37 -->
