# Audit round 69 — geom.warp

## A pinned vertex that no triangle uses never reaches its target
- where: packages/geom/src/warp/arap.ts:75 (piecesOf), :146 (createArapSolver → solve)
- scenario: `createArapSolver(mesh, [v, ...])` where vertex `v` appears in no triangle (an unused point left in `vertices`, as pinWarpMesh's own lattice/outline points can be). `piecesOf` only collects vertices met through triangles, so `v` is in no piece, solved or carried; `out` starts as a copy of the rest vertices and nothing writes `v`. `solve` returns `v` at its rest position, not at its pin's target, though the contract says each pinned vertex's target is taken and every vertex's position returned. Its pin still enters the `whole` rigid fit, so pinless pieces move toward a pin that itself did not move. Should place `v` at its target (or reject the pin).
- evidence: read
- severity: low

## `iterations: 0` is documented to return the two linear steps' result alone, but the injective pass still runs after it
- where: packages/geom/src/warp/arap.ts:44 (ArapSolveOptions.iterations), :175-210 (solve)
- scenario: `solver.solve(targets, { iterations: 0 })` on a pull hard enough that the rigid step turns a triangle over. The doc says 0 "returns their result alone"; the code skips the local/global rounds but then finds the piece tangled and runs up to `ARAP_INJECTIVE_ROUNDS` injective rounds, returning their result. Only `injectiveIterations: 0` as well gives the linear steps' result. Doc and code disagree on what the option does.
- evidence: read
- severity: low

## `invertedTriangles` counts every triangle that is flat at rest as turned over
- where: packages/geom/src/warp/foldCases.ts:74 (invertedTriangles)
- scenario: a mesh holding a zero-area rest triangle (refineTriangulation and earcut can leave a collinear sliver; the solver itself skips them via `frames.side === 0`). `Math.sign(area(V, t))` is 0, so `area(at, t) * 0 <= 0` holds and the triangle is counted as inverted whatever the solve did. The fold measure the tests read reports folds the solver cannot fix and never made; flat-at-rest triangles should be skipped, as `flipBound` skips them.
- evidence: read
- severity: low

## The bench resolves two pins on one vertex differently from the pin warp it measures
- where: packages/geom/src/warp/warp.bench.ts:66-71 (solveCase)
- scenario: two pins of a case snapping to one outline vertex (ruled 2026-11-20 in docs/unruled.md: they move it by the mean of their drags, which `solveRig` in pinWarp.ts implements). `solveCase` keeps the first pin's drag and drops the second, so the solve it times has different targets, and possibly a different fold and injective round count, from what `pinWarpMap` (timed by `refitCase` in the same record) solves. The same decision is answered two ways; the bench should build its targets through the same rule (or through `pinWarpSolve`).
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
