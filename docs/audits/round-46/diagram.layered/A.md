I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole document is below as the brief allows. The frozen commit `6438325dbf…` isn't in this clone. I read `packages/diagram/src/layered/` at HEAD `782733b19c` instead; that directory has no local changes.

```markdown
# Audit round 46 — diagram.layered

## settleAcross sizes a cluster's column without its `minWidth`, so a held pin can land inside a titled cluster's drawn box
- where: packages/diagram/src/layered/across.ts:176 (spanOf), used by itemsAt:167 and settleLevel:98
- scenario: down layout (cross = x). Cluster C has a title, so `dataClusters` gives it a `minWidth` wider than its one 80-wide member plus inset. `packClusters` (cluster.ts:305 `widen`) and `clusterBox` (clusterBox.ts:96) both widen C's box to `minWidth`. `settleAcross` measures C's column as the members' span plus insets only. A second pinned node held just past the member's inset edge, but inside the `minWidth` box, passes `clear()` (across.ts:201). `holdPins` then holds it, and the pin is drawn over C's box and title. The function's contract says that case returns `undefined` ("a cluster's box over a pin it does not hold"). Neighbors that `squeeze` pushes clear of the column likewise clear only the narrower span.
- evidence: read (cluster.ts:305–311 widens when `axes.cross === 'x'`; across.ts spanOf/padOf never read `minWidth`)
- severity: medium

## settleAcross pads a cluster's column by every nested cluster's inset on both sides, wider than the box packClusters draws
- where: packages/diagram/src/layered/across.ts:185 (padOf)
- scenario: cluster P holds nodes a and b, with nested cluster C between them across. `packClusters` puts P's box edge P.inset beyond its outermost content (a and b), so C's inset adds nothing on either side. `padOf` adds the largest child pad to both sides wherever the child sits, so the column comes out 2×C.inset wider than the box. When P holds a pin, `settleLevel` fixes the over-wide column (lines 98–99). `clear()` then rejects a second pin or free node that is clear of the real box but inside the phantom pad. That pin is marked `unheld`, or neighbors are pushed further than needed. `inward.ts` `clusterBoxes` builds the same box from where the child actually sits, so the two disagree on how wide a cluster is across.
- evidence: read
- severity: low

## turnOutward's drawing span ignores cluster `minWidth`, so placeholders inside a titled cluster's widened box count as outside the drawing
- where: packages/diagram/src/layered/inward.ts:99 (clusterBoxes), read by drawingSpan:83
- scenario: down layout. The outermost thing on the high side is a titled cluster whose `minWidth` box (as packClusters lays it out) reaches past its members. A run of free placeholders sits beside the members but inside that widened box. It reaches past `hull[1]` by more than `SLACK`, so `turnOutward` moves an unclustered node outward past the run. The run is already inside the drawing, so the rank is reordered for nothing. This is the same omission as in `settleAcross`; `packClusters` and `clusterBox` both widen to `minWidth`.
- evidence: read
- severity: low

## levelRoutes treats only node boxes as obstacles, so an edge between two level pins runs straight through a cluster box neither end is in
- where: packages/diagram/src/layered/level.ts:64 (levelRoutes `others`), between:90, around:106
- scenario: two pinned nodes A and B end up level along the rank axis, with cluster K's box between them across and no node box in the gap. Only `boxes` is consulted, and plan.ts:186 builds that from `graph.nodes` alone, so `between()` finds nothing in the way. The edge gets facing side ports and a straight run that crosses K's box. `around()`'s standoff likewise ignores cluster boxes, so a detour can end inside one. The package's own test helper `wiresThroughBoxes` (overlaps.ts:45) counts a wire through a cluster box neither end belongs to as a defect.
- evidence: read
- severity: low

## Files read
packages/diagram/src/layered/across.ts
packages/diagram/src/layered/bands.ts
packages/diagram/src/layered/cloudFixture.ts
packages/diagram/src/layered/cycles.ts
packages/diagram/src/layered/expand.ts
packages/diagram/src/layered/fixtures.ts
packages/diagram/src/layered/inward.ts
packages/diagram/src/layered/level.ts
packages/diagram/src/layered/order.ts
packages/diagram/src/layered/overlaps.ts
packages/diagram/src/layered/pins.ts
packages/diagram/src/layered/place.ts
packages/diagram/src/layered/places.ts
packages/diagram/src/layered/plan.ts
packages/diagram/src/layered/rank.ts
packages/diagram/src/layered/reach.ts
packages/diagram/src/layered/types.ts

<!-- done: 4 findings, files read: 17 -->
```

<!-- done: 4 findings, files read: 17 -->