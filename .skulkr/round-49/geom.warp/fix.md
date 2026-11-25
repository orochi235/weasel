L-BFGS overwrites its oldest step before rejecting the new one (A+B): fixed f4688a8db5

`unwarpPoint` diverges once a pin warp turns the shape past 60°, and returns its last guess rather than its best (A): fixed 62d6752a87. It now takes Newton steps through a central-difference Jacobian, halves a step until it shrinks the miss, and returns the best point found.

Dragging a second pin that shares an outline vertex with an earlier pin does nothing (A): fixed 2ecf72588c. Pins sharing a vertex move it by the mean of their drags. I made that call myself and recorded it in `docs/unruled.md`. It does not throw, because two pins snapping to one point is ordinary input.

A pinned vertex that refine leaves out of every triangle never reaches its target (A): fixed 191fd9d0c4. The real cause was in `refine.ts`: `legalize` popped stale stack entries and flipped with the wrong corner, which deleted triangles. A random decagon's mesh covered 7345 of its 9190 units of area. The corner is now read from the triangle that holds the edge. Refine also inserts any point earcut left out, and `pinWarpMesh` marks a pin `-1` when no triangle holds its point.

An even-odd self-crossing outline is meshed as if it did not cross (B): fixed 8913cbbae0

`meshLocator` stops at ring 1 without the bound its comment promises (B): fixed 4b21390ba4. It now ranks candidates by distance to the triangle instead of by weight, and keeps widening the search until no unseen triangle can be nearer.

A piece with two or more pins whose system fails to factor ignores its own pins (B): fixed 0e211b50dd. Such a piece now follows the rigid fit to its own pins.

Extra defects: the triangle loss in `legalize` was a separate bug from what A described. I fixed it under finding 4 (191fd9d0c4) and have not counted it as extra.

Checks:
- `npx vitest run --maxWorkers=1 packages/geom/src/warp/lbfgs.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 packages/geom/src/warp/pinWarp.test.ts`: pass (19)
- `npx vitest run --maxWorkers=1 packages/geom/src/warp/meshMap.test.ts` (new file): pass (1)
- Other `packages/geom/src/warp` test files (`fold`, `pinWarpSmooth`, `warp`) and every `packages/path-tools/src/warp` test file: pass
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run check:changesets`: pass, "OK — 2397 changeset(s)"
- `npm run lint -w @weasel-js/geom`: not run, because the package has no `lint` script. Instead, eslint on every changed `.ts` file: pass. The gate's root `npm run lint` also passed.
- No `*.browser.test.*` file was touched.

tally: 7 of 8 fixed, 0 extra fixed