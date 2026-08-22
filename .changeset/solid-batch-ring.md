---
'@weasel-js/core': patch
---

The solid batch no longer rewrites one pair of GL buffers on every flush. It
cycles a ring of buffer sets instead — 64 slot-sized ones, plus 4 growable ones
for a flush too big for a slot — so a write lands that many draws behind the
draw that read the same buffer. On an M2 Max via ANGLE a flush goes from ~54 us
to ~4.4, which is the cost anything that breaks a run of solid geometry was
paying: entering a clip is 64.9 us -> 10.2, and a boundary between solid and any
other command kind is 28.4 us -> 2.5. Measured by `tests/perf/clip-cost.spec.ts`
and `tests/perf/transition-matrix.spec.ts`.

The driver tracks a write hazard per buffer object, so a flush that overwrote
its buffers from offset 0 waited on the draw still reading them. Writing
disjoint ranges of one buffer does not escape that — the hazard is per object,
not per range.

Nothing about the API or the pixels changes. Buffers are taken on first use
rather than at construction, so a renderer that never draws solid geometry
allocates none, and every set is freed in `WeaselRenderer.dispose`.
