# Audit round 69 — geom.warp

## Lawson flips in `refineTriangulation`'s initial pass re-queue only two of a flip's four outer edges, so the result is not Delaunay
- where: packages/geom/src/warp/refine.ts:80 (Triangulation.legalize), driven from refine.ts:161-165 (refineTriangulation)
- scenario: the first pass legalizes every edge of every earcut triangle, where `w` is an arbitrary corner rather than a just-inserted point. A flip of `u→v` into `(u,q,w)`/`(q,v,w)` pushes only `u→q` and `q→v`. Edges `v→w` and `w→u` now belong to a triangle whose far corner changed (`q` replaced `u`/`v`), and nothing rechecks them if the loop over the snapshot already visited them (for example, when the flipped edge was the triangle's third, `legalize(c, a)`). Earcut's slivers in a long thin region then survive next to a flipped pair. The doc's "an edge two triangles share is flipped while the far corner of one lies inside the other's circumcircle" doesn't hold when the pass ends. The ARAP systems and Clough–Tocher ordinates are then built over needle triangles the flips should have removed. Correct Lawson pushes all four outer edges of the quad, or runs a queue to a fixed point.
- evidence: read
- severity: low

## `fillLattice` offsets alternate rows by h/4, not h/2, so the lattice is not triangular
- where: packages/geom/src/warp/pinWarpMesh.ts:190 (fillLattice)
- scenario: rows are `rowH = h·√3/2` apart. Even rows start at `x0 + h/4` and odd rows at `x0 + h/2`, a shift of h/4 between neighbors. A row-to-row edge is then √((h/4)² + (0.866h)²) ≈ 0.90h one way and √((3h/4)² + (0.866h)²) ≈ 1.15h the other, not h. The doc comment ("a triangular lattice of spacing `h`") and the file header ("keep the triangles near equilateral") promise equilateral triangles, but every interior triangle comes out skewed and the Delaunay flips can't fix that. The starting offsets should differ by h/2 (for example, h/4 and 3h/4).
- evidence: read
- severity: low

## The warp bench solves with each shared vertex's first pin's drag, where `pinWarpMap` uses the mean of the drags
- where: packages/geom/src/warp/warp.bench.ts:66-71 (solveCase), against packages/geom/src/warp/pinWarp.ts:71-84 (solveRig)
- scenario: two pins snap to one vertex, as `docs/unruled.md` (2026-11-20) rules they may. The bench keeps the first pin's drag (`pinned.includes(v)` returns early), while `solveRig` moves the vertex by the mean of both drags. That ruling replaced exactly this first-pin behavior. So for such a case the bench's `solveMs` and injective round count measure a different solve from the one the shape is drawn with. The two places answer the same question two ways; the bench should build its targets the way `solveRig` does.
- evidence: read
- severity: low

## A pinned vertex that no triangle uses is never moved to its target
- where: packages/geom/src/warp/arap.ts:75-97 (piecesOf), 138-155 (createArapSolver.solve)
- scenario: `createArapSolver({ vertices, triangles }, [v])` where `v` is in no triangle, such as a stray vertex in a mesh built by a caller and passed to the exported solver. `piecesOf` builds pieces only from triangles, so `v` is in no piece and in no `carried` entry. `solve` returns it at its rest position, not at its target. The interface doc says `solve` takes each pinned vertex's target and returns every vertex's position. `pinWarpMesh` avoids this case only because it pins held vertices alone. A pinned isolated vertex should land on its target.
- evidence: read
- severity: low

## The trace reports the injective fallback under a round number that never ran
- where: packages/geom/src/warp/arap.ts:182-209 (createArapSolver.solve)
- scenario: when a piece is still tangled after the injective pass, the fallback calls `report('injective', r)` with `r` already one past the last round that ran. With the default cap that is round 101 of a 100-round cap, or the next index after an early stop. `ArapStep.round` is documented as "Which round of its stage, from 1", so a trace consumer (the bench's `rounds` record, a debug UI's round counter) counts an injective round that didn't run. The fallback should be reported under the last round's number, or under a stage of its own.
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

<!-- done: 5 findings, files read: 18 -->
