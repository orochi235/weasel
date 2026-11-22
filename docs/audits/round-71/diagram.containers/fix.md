commitLaneResizeToScene writes locked nodes and sizes below MIN_LANE_SIZE (A+B: A's first finding with B's second) | fixed acb21f728e (the default commit now checks the same locks as the drag plus the pool's own lock, raises a short size to the minimum, and throws `RangeError` for a size that isn't finite; strict call recorded in `docs/unruled.md`)
commitLaneResizeToScene writes pool and lanes without checking locks (B) | duplicate of A's first finding, fixed acb21f728e
Pool stack axis answered two ways, header in poolAxisOf vs layout key; a pool with no header rejects every lane (A) | fixed 154aec98f0 (pool and lane layouts carry their axis; `poolAxisOf`, `diagramCanDropInto`, the lane boundary layer, `regionSync`, and `sceneReaders` read it through one function)
Double-click on a locked region's header still starts editing its title (B) | fixed 1b90f3d97b (`regionHeaderAt` returns null when the region or its title node is locked)

Extra:
Theme lane ordering read the pool's axis off its header, a third copy of the axis mistake (sweep, `packages/diagram/src/theme/themeWrites.ts`) | fixed 154aec98f0

Checks:
- `npx vitest run --maxWorkers=1` on `containerActions.test.ts`, `containerTitle.test.ts`, and `canDropInto.test.ts`, one at a time: pass (each fails before its fix)
- related tests (every test file under `containers/` and `theme/`, plus the `regionSync`, `regionEditing`, and `sceneReaders` tests): pass, 27 files, 200 tests; no browser tests unrun
- `npm run typecheck:packages -- diagram diagram-formats`: pass
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed `check:part-caches` on the axis tag I added; I put it on the allowlist (it is set by `stacksAlong` and only read, never built on a lookup) in the same commit.
- `npm run lint -w <pkg>`: neither `@weasel-js/diagram` nor `@weasel-js/diagram-formats` has a `lint` script (npm error: missing script). `npx eslint` on every changed `.ts` file: pass
- tree clean

tally: 4 of 4 fixed, 1 extra fixed