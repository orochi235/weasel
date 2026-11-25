# Audit round 67 — diagram.layered

## settleAcross gives up on a whole rank when any unrelated tall free column shares it
- where: packages/diagram/src/layered/across.ts:106 (settleLevel)
- scenario: a rank holds two pins P1 and P2 with a single-rank free node N preferring the room between them, too narrow for N, so `squeeze` leaves the rank unclear and only `jump` could place N past a pin. If that rank also holds a free cluster column C spanning several ranks, far from both pins and overlapping nothing, line 106 returns `false` because `list.some(free && tall)` is true. `settleAcross` then returns `undefined`, and `holdPins` reports the second pin unheld (pins.ts:92). The check fires whenever any tall free item is in the rank, not only when the tall item is what is unclear; `jump` could treat C as a block (it only repositions free items) and place N. What should happen: the pin is held, with N jumped past it, as it is when C is absent.
- evidence: read (inference from the control flow; not run)
- severity: medium

## transpose has no global potential once a port has several places, so it can cycle
- where: packages/diagram/src/layered/order.ts:239 (transpose)
- scenario: `cost(u, v)` counts only the crossings between u's hops and v's hops. With a port that has several places (`fromPlaces`/`toPlaces`), `landing` goes through `placeAmong`, which reads where u and v fall among the neighbor's other wires. Swapping u and v can move u's (and v's) landing to a different place on that neighbor, which changes how u's hops cross the hops of a third node w. `cost` does not count that change. A swap that lowers the local cost can raise the total, and the `while (improved)` loop has no bound and no monotone total to stop it. A sequence of locally improving swaps that returns to an earlier order would then loop forever. With single-place ports the local count is exact and the loop terminates.
- evidence: inference (read; no input found that cycles)
- severity: low

## An authored edge between adjacent ranks loses its hop when another edge's label row lands between them
- where: packages/diagram/src/layered/expand.ts:177 (expand)
- scenario: authored edge A→B between node ranks 2 and 3, plus an unrelated labeled edge whose label row goes in gap 2. `labelRowsOf` puts B two rows below A, so `b[0] - a[1] > 1` and the authored edge is skipped with no hops at all. Without that label row the same edge gets a direct A→B hop that ordering and `placeAcross` align on. Whether an authored edge takes part in ordering and alignment then depends on an unrelated edge's label. What should happen: the gap is counted in node ranks (or label rows are excluded from it), so an authored edge between adjacent ranks keeps its hop through the label row.
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

<!-- done: 3 findings, files read: 18 -->
