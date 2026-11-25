I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the whole document is below. One more thing: `HEAD` here is `d057251407`, not the `2f3b11aab7` the brief names, and I reviewed the tree as it is.

# Audit round 49 — geom.warp

## A pin warp's mesh fills an even-odd path's self-crossing outline as if it did not cross
- where: packages/geom/src/warp/pinWarpMesh.ts:48 (ringsOf)
- scenario: take an `evenodd` path whose outline crosses itself, such as a five-point star drawn as one pentagram contour. `ringsOf` returns the flattened outline without resolving any crossings. `nestRings` then sees one ring with winding ±1, and `regionsOf` treats all of it as filled. So the center pentagon, which even-odd leaves empty, gets meshed as fill. earcut is also handed a self-intersecting ring, which gives overlapping or missing triangles. The pin warp then pulls through area the shape doesn't have, and the ARAP solve runs on a mesh that isn't a valid triangulation. The renderer handles the same case differently: `tessellatePolygon` (packages/geom/src/tessellate/tessellate.ts:166) resolves even-odd crossings first, through `evenOddRings` and then `resolveEvenOdd`. This file's nonzero branch matches the renderer and its even-odd branch doesn't.
- evidence: read
- severity: medium

## L-BFGS overwrites its oldest remembered step pair before it decides to drop the new one
- where: packages/geom/src/warp/lbfgs.ts:49-63 (remember)
- scenario: when the memory is full (`count === DEPTH`), `slot = (newest + 1) % DEPTH` is the oldest pair still in use. `remember` overwrites that slot's `s`, `y` and `Py` in place, and only after that checks `sy`. If `sy <= 1e-12` (no positive curvature, which happens near folds in the injective pass), it returns without updating `newest` or `count`. The slot now holds the rejected pair next to the old `rho`, and the next `descent` still reads it as the oldest entry. The resulting direction can stop being a descent direction, in which case `untangleRound` discards the memory, or it descends poorly. Either way the injective pass takes more rounds or stops short.
- evidence: read
- severity: medium

## meshLocator's search ends at ring 1 without the bound its comment promises
- where: packages/geom/src/warp/meshMap.ts:63-80 (meshLocator)
- scenario: the comment says the search widens until "the nearest found cannot be beaten by a farther ring". The code instead returns `best` as soon as any ring ≥ 1 has a candidate, with no bound check. For a point off the mesh (in a hole, in a concave notch, or past a border cell clamped by `cell`), the triangle it picks is the least-outside one near the start cell, not necessarily the nearest. `cloughTocherMap` then extrapolates from that triangle, so neighboring off-mesh points can jump between triangles and map with a kink.
- evidence: read
- severity: low

## A mesh piece holding two or more pins whose system fails to factor ignores its own pins
- where: packages/geom/src/warp/arap.ts:139-141 (createArapSolver)
- scenario: `buildPiece` returns null when either split system isn't positive definite, for example when every triangle in the piece is degenerate. The piece is then carried with `pin: pins.length === 1 ? pins[0] : -1`. With two or more pins that is always -1, so `whole`, the rigid fit to every pin in the mesh, moves the piece. Its own pins miss their targets, and pins in other pieces pull it along. A one-pin piece, by contrast, moves with its own pin.
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