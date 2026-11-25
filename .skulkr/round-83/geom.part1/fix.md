BVH query with a NaN or short coordinate visits every item (A+B): fixed c14a5fb6ef
BVH raycast with an infinite direction component ignores a negative tMax (A): fixed 99799798d8
`nearestPointsRayLine` treats lines up to 1e-6 rad apart as parallel (A): fixed 459b3d88d9. The cutoff is now sin θ > SINGULAR_RATIO, and both terms are computed from cross products. The reviewer's suggested threshold change on its own would not have worked: a·c − b² cancels to noise, and to 0 at 1e-9 rad.
`intersectRayPlane` returns NaN instead of null for a NaN origin or offset (B): fixed f048bfe288. It now also returns null for an infinite `t`, matching `intersectRayAabb`.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: bvh/bvhQuery.nan.test.ts 3 passed, bvh/bvh.test.ts 25 passed, 3d/ray3.slab.test.ts 5 passed, 3d/ray3.plane.test.ts 3 passed, 3d/ray3.rayLine.test.ts 3 passed, 3d/3d.test.ts 50 passed: pass
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: "checks:gate: all 33 passed": pass
- `npm run check:changesets`: "OK — 1190 changeset(s), 94 with warnings" (none of the warnings are from my changesets): pass
- `npm run lint -w @weasel-js/geom`: not run, because the package has no lint script. The root `npm run lint` passed inside the gate.
- Tree is clean.

tally: 4 of 4 fixed, 0 extra fixed