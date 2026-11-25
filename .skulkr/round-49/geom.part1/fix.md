lengthTable gave a straight segment length 0 when its squared length overflowed or underflowed (A): fixed e1d05887c0, and a769170623 switched it to geom's shared length rule
3D `len`/`distance` overflowed and underflowed, with knock-on effects in `intersectRayPlane`, `nearestPointOnLine` and `nearestPointsRayLine` (A): fixed 3f7618c02e (plus a769170623, same switch)
Quadratic and NURBS curve reps zeroed a small curve's curvature on an absolute threshold (A): fixed bca0f7ecb4 — all three reps now share `curvatureFromDerivatives`, which also stops speed³ overflowing past about 1e100 and underflowing under about 1e-100 (that was hitting the cubic too)
pathCrossings never found a cubic segment crossing itself (A): fixed 56f1699ac2 — new `segmentSelfCrossing`, solved in closed form
nearestPointsRayLine paired a zero-direction line with the ray's origin (B): fixed 165634852b
pathCrossings never tested a segment against itself (B): duplicate of A's pathCrossings finding, fixed 56f1699ac2
Curve reps' `toPath` wrote world coordinates into a Float32Array with no `origin` (B): fixed 41569314de — the new `polygonPathFrom` helper is also used by booleans' `writePath` and the booleans adapter, which spelled out the same steps
A subpath opened after `Z` with no `M` reused the previous subpath's anchor id, so anchor queries answered on the wrong subpath (B): fixed 38dbff367c — the strict call is recorded in `docs/unruled.md`: that subpath's first segment has no start anchor, so it takes no anchor range and no segment-fraction share

Extra:
3D lengths and line lengths in the length table disagreed with geom's 2D `distance` in the last bit: fixed a769170623. My first `Math.hypot` version broke `points.test.ts` "agree across the tiers", which holds the 2D, nd and 3D results to the same bits. The new `lengthOf3` uses the same steps as the 2D rule, and ray3's rescale now asks `squaresHeld` instead of using a second threshold. This repairs my own earlier commits, so it isn't counted below.

Checks:
- Touched test files, one at a time, `--maxWorkers=1`: along/farScale.test.ts pass (6), along/lengthTable.test.ts pass (20), 3d/farScale3.test.ts pass (9), curves/curvatureScale.test.ts pass (9), curves/toPathFar.test.ts pass (4), intersect/intersect.test.ts pass (12)
- `packages/geom` plus the consumers in stroke/trim, svg trim/seatedHeads, core NodeShape.trim and site curveLabInflections, `--maxWorkers=1`: pass, 186 files, 1942 tests
- `npm run checks:gate`: pass, "all 32 passed" (the first run failed `check:changesets` on titles over 140 characters; I shortened them and folded the fixes into their commits)
- `npm run lint -w @weasel-js/geom`: not run, because geom has no `lint` script ("Missing script: lint"). In its place I ran eslint on every changed file: pass. `check:size`: pass. `typecheck:packages -- geom`: pass
- No browser test files touched. Tree clean.

tally: 8 of 9 fixed, 0 extra fixed