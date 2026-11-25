Cut joint that only touches the boundary counts as a crossing, knife and scissors (A): fixed 452b06c162

Cusp at t = 0.5 makes `orientBoundaries` drop the contour (B): fixed 6f8f58fecf

Snip cuts a path that runs along the cut and leaves on the side it came from (B): fixed 452b06c162

Mesh snapping in `meshJunctions` and `coverageBoundary` scales with distance from the origin (A): fixed 6e33a64e7c

Clipper retry grid scaled by the largest coordinate, so small shapes far out collapse (B): fixed f87063de0f. The clipper now throws instead of returning collapsed shapes; recorded in `docs/unruled.md`.

Docs say self-crossing cubics are flattened (A): fixed 24d0b24d87

Extra, path crosses the cut at a joint while only touching one segment's line, so the crossing was missed (sweep): fixed 452b06c162

Checks:
- `npx vitest run --maxWorkers=1` on `splitBySegment.test.ts` (65 passed), `contours.test.ts` (3 passed), `clipper.test.ts` (3 passed), and `trianglesToPath.test.ts` (9 passed): pass
- the `packages/geom/src/booleans` directory (15 files, 254 tests) and `packages/stroke/src/strokeToPath*` (2 files, 25 tests): pass
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/geom`: not run, because geom has no `lint` script. The root `npm run lint` passed inside the gate.
- `npm run check:changesets`: pass, no warnings on the new changesets
- The tree is clean.

tally: 6 of 6 fixed, 1 extra fixed