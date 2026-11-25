# Audit round 67: diagram.layered

## An authored edge with a label reserves an empty label row and then drops its own hop
- where: packages/diagram/src/layered/expand.ts:133 (expand → labelRowsOf) and :177
- scenario: an edge with `authored: true` and a `label`, joining nodes in adjacent ranks r and r+1. `labelRowsOf` does not check `authored`, so it inserts a label row between r and r+1. The main loop then measures the span on the post-label ranks (`b[0] - a[1]` is now 2), hits `if (d.authored && b[0] - a[1] > 1) continue`, and skips the edge entirely. The result is an empty row (still listed in `labelRows`, so plan.ts:132 also shrinks the gaps on both sides of it), no label placeholder and no `labels` entry. The edge also loses the direct hop it would have had with no label, so ordering and placement no longer pull its ends together. The same thing happens to an authored edge spanning several ranks: it claims a label row that nothing uses, even though `GraphEdge.authored` promises "keeps no room for it in the ranks it crosses". What should happen: `labelRowsOf` skips authored edges, or the authored test reads the span before label rows are added.
- evidence: read
- severity: medium

## settleAcross gives up on a pin whenever its rank holds any free multi-rank column, even one nowhere near the conflict
- where: packages/diagram/src/layered/across.ts:106 (settleLevel)
- scenario: a rank holds two held pins P1 and P2, a free single-rank node X squeezed between them with too little room, and, elsewhere in the same rank, a free cluster column C spanning several ranks that overlaps nothing. `squeeze` cannot fit X, so `clear` fails. Line 106 then returns `false` because C is tall and free, and the pin is reported `unheld`. `jump` could have moved X past P2 without touching C. What should happen: only a tall item that is itself part of the overlap blocks the jump, or `jump` keeps tall items where `squeeze` put them and moves only single-rank items. Instead, an unrelated cluster column decides whether a pin is held.
- evidence: read
- severity: low

## Files read
packages/diagram/src/layered/across.ts
packages/diagram/src/layered/bands.ts
packages/diagram/src/layered/cloudFixture.ts
packages/diagram/src/layered/clusterSpans.ts
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

<!-- done: 2 findings, files read: 18 -->
