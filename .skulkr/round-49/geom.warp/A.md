I couldn't save the findings to `.skulk/out/findings.md` because the write permission wasn't granted, so here is the whole findings document.

# Audit round 49: `geom.warp` findings

## unwarpPoint fails to converge when a pin warp turns the shape more than 60°, and returns its last guess rather than its best
- where: packages/geom/src/warp/pinWarp.ts:122 (unwarpPoint)
- scenario: each step moves the guess by the miss: `p ← p + (target − map(p))`. When the map is close to a rotation R, every step multiplies the miss by `I − R`. That has magnitude `2·sin(θ/2)`, which is above 1 once θ is past 60°. So pin a shape and drag the pins until it turns 90° or 180°; dragging two pins past each other is enough. Then Add Pin (`packages/path-tools/src/warp/warpActions.ts:228`) calls `unwarpPoint(pathWarpMap(...), to)`. For a 180° turn about c, `map(p) = 2c − p`, so the miss doubles every step, and after 50 steps `p` is about 2^50·|t − c| away. The docstring says it is for "a map that stays close to rigid, as a pin warp's does", and a rotation is rigid. It also says it "Returns the best point found", but the loop returns the last `p`. The new pin's `from` ends up around 1e15 off the shape. pinWarpMesh snaps it to the outline, solveRig's target `to + vertex − from` comes out around 1e15, and the shape is flung away. Expected: a solver that converges under rotation (step through the local Jacobian, or the inverse of the nearest rigid fit), and at minimum returning the guess with the smallest miss.
- evidence: read
- severity: high

## Dropping a rejected step corrupts the oldest saved step once the L-BFGS memory is full
- where: packages/geom/src/warp/lbfgs.ts:49-63 (remember)
- scenario: when `count === DEPTH`, `slot = (newest + 1) % DEPTH` is the oldest saved step, and the descent loop still reads it (k = DEPTH − 1). `remember` copies the new step's `s`, `y` and `bentTurns` into that slot before it checks `sy > 1e-12`. When the check fails it returns without updating `rho[slot]`, `newest` or `count`. The memory then holds a step whose `s·y ≤ 1e-12` (possibly negative), paired with the old step's `rho`. `descent` keeps using it, so the curvature estimate is no longer valid and can point the wrong way. The resulting directions can stop going downhill, which drops `untangleRound` into `forget` and a plain gradient step, or they come out badly scaled. This can happen in the injective pass whenever a step after six accepted ones fails the check, for example when `eps` changes between rounds. Expected: compute `sy` first and write the slot only once the step is accepted.
- evidence: read
- severity: medium

## Dragging a pin does nothing when an earlier pin already holds the same vertex
- where: packages/geom/src/warp/pinWarpMesh.ts:128 (placePin), packages/geom/src/warp/pinWarp.ts:73-79 (solveRig), packages/geom/src/warp/arap.ts:132
- scenario: a pin on or outside the outline moves to the nearest outline point, and shares a ring vertex when it is within `0.25·h` of one. Take a square spanning 0..100. Two pins outside it on the same side, at `(−50, 50)` and `(−10, 50)`, both snap to `(0, 50)` and share one vertex. Two outline pins about 1 unit apart do the same, since h ≈ 5 there. `solveRig` keeps only the first pin's target for a vertex (`seen`), and `createArapSolver` keeps only the first pin index (`pinAt`). Dragging the second pin moves its handle (`warpControls` returns `p.to`) but leaves the shape unchanged. Pins inside the fill only merge within `1e-9·h` (pinWarpMesh.ts:119), so two distinct pins stay independent inside the fill but not on or off the outline. Expected: distinct pins either get distinct vertices or combine their targets (for example, the mean of their displacements), and none is dropped silently.
- evidence: read
- severity: medium

## A pinned vertex that refine leaves out of every triangle stays where it was and never reaches its target
- where: packages/geom/src/warp/arap.ts:145-157 (createArapSolver, solve), packages/geom/src/warp/refine.ts:160
- scenario: `refineTriangulation` leaves out an inner point that no triangle holds, but `pinWarpMesh` still points `pinVertex[k]` at it (pinWarpMesh.ts:223). `piecesOf` only collects vertices that are in some triangle, so this vertex belongs to no solved piece and no carried one. `solve` starts from a copy of the rest positions and never writes it, so the pin's vertex never reaches its target. The pin still counts in `rigidFit`, which moves the pieces that hold no pin. This happens wherever `inside()` (tested against the resampled rings) and earcut's coverage disagree, for example a ring earcut triangulates imperfectly. Expected: either `pinWarpMesh` marks such a pin as unplaced (`-1`, so it is dropped the same way off-mesh pins are), or the solver puts every pinned vertex at its target.
- evidence: read
- severity: low

## Files read
packages/geom/src/warp/arap.ts
packages/geom/src/warp/arapPiece.ts
packages/geom/src/warp/arapSystem.ts
packages/geom/src/warp/cloughTocher.ts
packages/geom/src/warp/foldCases.ts
packages/geom/src/warp/index.ts
packages/geom/src/warp/injective.ts
packages/geom/src/warp/lbfgs.ts
packages/geom/src/warp/mesh.ts
packages/geom/src/warp/meshMap.ts
packages/geom/src/warp/pathWarp.ts
packages/geom/src/warp/pinWarp.ts
packages/geom/src/warp/pinWarpMesh.ts
packages/geom/src/warp/profileCholesky.ts
packages/geom/src/warp/quad.ts
packages/geom/src/warp/refine.ts
packages/geom/src/warp/warp.bench.ts
packages/geom/src/warp/warpPath.ts

<!-- done: 4 findings, files read: 18 -->