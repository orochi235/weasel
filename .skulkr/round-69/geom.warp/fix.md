- Pinned vertex that no triangle uses never reaches its target (A+B): fixed aa30dc2bfe. Each such vertex is now a piece of its own: pinned, it lands on its target; unpinned, it moves with the pins as a whole.
- Injective fallback traced under a round number that never ran (B): fixed 4181d3c310. It is now reported under the last round that ran.
- `iterations: 0` doc says the linear steps' result is returned alone, but the injective pass still runs (A): fixed 1a99d244bb. The doc was wrong, not the code: the injective pass is governed by its own option, `injectiveIterations`. This is a doc-only change, so no test could fail before it.
- `invertedTriangles` counts triangles that are flat at rest as turned over (A): fixed f14444f967. This is a test fixture, so it has no changeset.
- Bench (and fold tests) keep the first pin's drag on a shared vertex instead of the mean (A+B): fixed 07a045b5cc. I extracted `pinTargets` in `pinWarp.ts`, and `pinWarpMap`, the bench, and `fold.test.ts` now all use it. No changeset, since no consumer sees it.
- Lawson flips requeue only two of four outer edges, so the result is not Delaunay (B): fixed 838190246d.
- `fillLattice` offsets alternate rows by h/4, not h/2 (B): fixed 19e5658b7b. Rows now start at h/4 and 3h/4. This changed the anchor counts pinned in `fold.test.ts` from 4 and 10 to 5 and 11, which I updated.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on the touched files: `arap.test.ts` pass (2), `refine.test.ts` pass (1), `fold.test.ts` pass (14), `pinWarp.test.ts` pass (21).
- Downstream test files that use the pin warp: `PinWarpLabDemo.test.tsx` pass, `PinWarpSolverLabDemo.test.tsx` pass, `pinWarpSolverMesh.test.ts` pass, `geom/src/exports.test.ts` pass, `pathOriginReaders.test.ts` pass, `useWarpTool.test.tsx` pass.
- Unrun: `PinWarpSolverLabDemo.browser.test.tsx` (browser test).
- `npm run checks:gate`: all 33 passed. It ran before I shortened three changeset titles; I then reran `npm run check:changesets` alone and it passed (OK — 232 changesets).
- `npm run lint -w @weasel-js/geom`: geom has no lint script. `npx eslint packages/geom/src/warp` passed, and so did the gate's root `npm run lint`.

Tree is clean apart from `.skulkr/`.

tally: 9 of 9 fixed, 0 extra fixed