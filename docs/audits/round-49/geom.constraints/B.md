I couldn't write `.skulk/out/findings.md`: permission to write there was denied. Here is the whole document instead.

Two notes on the setup: the checkout's HEAD is `d057251407`, not the frozen commit `2f3b11aa…` named in the brief, so the paths and line numbers below are from that HEAD. I also checked `residuals.ts`'s derivatives (tangent, parallel/perpendicular, onPath) by hand and found them correct.

## anchorsBefore takes an anchor the edit added at an open subpath's end for a copy of its neighbor, so constraints and `fixed` references move onto the new anchor
- where: packages/geom/src/constraints/pathConstraints.ts:90 (anchorsBefore); consumed by remapConstraints:107 and pathsEdit.ts:157
- scenario: `editAnchorSetTracked`'s `blended` gives an anchor added past either end of an open subpath the origin `{ a, b: a, t: 0 }` (anchorOrigins.ts:100), the same shape a kept or copied anchor gets. `anchorsBefore` only rejects `t !== 0 && a !== b`, so it answers old anchor `a` for the new anchor. Prepend an anchor before anchor 0 of an open path that carries `fixed(0)` (or `horizontal [0,1]`): the new anchor (index 0) and the original (index 1) both map to old 0. `remapConstraints` keeps the first, so the constraint now names the new anchor. `reference[0]` is old anchor 0's place, so the solve pins the new anchor back onto the old anchor's position, and the original anchor loses its constraint. Appending also gives the new anchor its neighbor's `reference`. Should: an anchor the edit made (no held point of its own) maps to `undefined`. Telling the two cases apart needs something other than `t` (e.g. whether the origin came from `held`).
- evidence: read
- severity: medium

## An item's own constraint naming an anchor past its path's count binds to another item's anchor in constrainPathsEdit
- where: packages/geom/src/constraints/pathsEdit.ts:134 (constrainPathsEdit)
- scenario: each item's constraints are shifted by `wasStart[i] + a`, with no check that `a` is below that item's anchor count. Take items [A (4 anchors), B (3 anchors)], with A carrying a stale `fixed(5)` or `horizontal [3, 4]` (constraints kept in scene data after an edit made outside constraint-aware code). The global index lands on one of B's anchors, and `constraintApplies` passes against the combined count. The solve then constrains B's anchors by A's constraint, and line 184 files it under item B, renumbered into B's anchors. With a single item the same constraint is caught as not applying. Negative indices likewise reach the previous item. Should: map an out-of-range own anchor to a constraint that cannot apply (as the link path does with `fixed -1`), so it is reported unsatisfied on its own item.
- evidence: read
- severity: low

## Files read
packages/geom/src/constraints/check.ts
packages/geom/src/constraints/conflicts.ts
packages/geom/src/constraints/index.ts
packages/geom/src/constraints/pathConstraints.ts
packages/geom/src/constraints/pathsEdit.ts
packages/geom/src/constraints/points.ts
packages/geom/src/constraints/residuals.ts
packages/geom/src/constraints/solve.ts
packages/geom/src/constraints/sparse.ts
packages/geom/src/constraints/types.ts

<!-- done: 2 findings, files read: 10 -->