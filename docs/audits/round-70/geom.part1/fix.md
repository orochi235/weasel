- Ray with an infinite direction component hits at t = 0 in `intersectRayAabb` and the BVH's `entry` (A): fixed f15922a63c
- `aabbOfPoints` doc names two references that disagree, and all-NaN input gives an inverted box; `boundsOfCoords` does the same (A): fixed 899b329ec6. This was a behavior call: NaN is still skipped, and an axis with no number now answers null. It is recorded in `docs/unruled.md`. `plot`'s `worldBox` and `kernel3d`'s `poseFromBounds` now read that null as a NaN box.
- `lengthAtCurve` throws on a fractional or NaN `run` (A+B): fixed b4d899b25f
- Bezier cubic, Bezier quadratic, and Spiro throw on a NaN parameter where NURBS answers (A): fixed 65b38d14ea
- `squarable` overflows `1 / k` for a subnormal direction (B): fixed 76a5b68cdb
- `segmentCrossings` misses a zero-length line lying on the other segment (B): fixed d5543ddaf3
- `lengthAtCurve` throws on a NaN run (B): duplicate of A's `lengthAtCurve` finding, fixed b4d899b25f

Extra:
- `runSegments` throws on a run index that names no run (fractional, NaN, negative, or out of range) (sweep): fixed b100ce2bc2
- `intersectRayAabb` and the BVH's `entry` returned Infinity as a hit distance for an infinite origin (sweep): fixed in f15922a63c, together with the first finding

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `3d/ray3.slab.test.ts` pass, `3d/aabbOfPoints.test.ts` pass, `3d/squarable.test.ts` pass, `box.test.ts` pass, `intersect/intersect.test.ts` pass, `along/curvePosition.nan.test.ts` pass, `along/runSegments.test.ts` pass, `curves/nanParameter.test.ts` pass, `bvh/bvh.test.ts` pass, `3d/3d.test.ts` pass
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run lint -w` for `@weasel-js/geom`, `@weasel-js/plot`, and `@weasel-js/kernel3d`: none of the three has a `lint` script ("Missing script"). The root `npm run lint` passed inside the gate.
- The tree is clean.

tally: 7 of 7 fixed, 2 extra fixed