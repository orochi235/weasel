I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 46: diagram.layered (blind reviewer)

## A level edge's detour runs through the box it detours around when that box reaches further toward the next rank than either end
- where: packages/diagram/src/layered/level.ts:106-120 (around), with :65-68 (levelRoutes)
- scenario: two pinned nodes `a` and `b` end up level along the rank axis (direction `down`, `rankGap` 96). A third node `c` sits between them across the rank, and its box reaches further down than both. For example, `a` and `b` are 40 tall at y 30..70 and `c` is 140 tall at y 0..140 (a taller node centered in the same band). `between` is true, so `around` puts the run at `edge + standoff`. But `edge` is the further of only `a`'s and `b`'s far sides (70), and `standoff` is `rankGap / 2` (48). The run therefore crosses at y 118, straight through `c` (0..140). The standoff loop can't catch this either: it only shrinks the standoff for boxes whose near side is beyond `edge` (`room > 0`), and `c`'s near side (0) is behind it. It should count the far side of the boxes in the way (the ones `between` found) in `edge`, so the detour clears `c`.
- evidence: read
- severity: medium

## A level route's two detour points are read back as a placeholder seed on the next pass
- where: packages/diagram/src/layered/plan.ts:188-193 (planOnce), with :84-88 (routed) and packages/diagram/src/layered/expand.ts:184-187 (expand, `now`)
- scenario: a graph with clusters or two pins runs `untilSettled`, and each pass seeds placeholders from the last pass's `waypoints` through `routed`. Take an edge between two level pins whose ranks are two apart, so it has one placeholder. `planOnce` replaces that edge's chain route with the two `around` points from `levelRoutes`. That list has length 2, which equals `crossings * 2`, so the next pass's `expand` reads it as "where the route crosses each rank now". It seeds the placeholder at `now[0][cross]`, the center of the `from` box at the detour, instead of interpolating between the ends. The same map holds two kinds of route under one key, rank-crossing pairs and detour points, and the reader tells them apart only by point count. It should keep level routes out of what `routed` hands back as seeds, or mark which kind a route is.
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

<!-- done: 2 findings, files read: 17 -->