pool takes inserts via empty `ids` (A): fixed eb511b7735
releasing a pool deletes its non-lane children (A): fixed 072219eabc
pool header decided two ways, layout default vs trait (A): fixed ecc48d7d75
new pool's first lanes overflow its box (A): not a defect (the insert runs the pool layout's `arrive`, which grows the pool to hold the lanes; a test building a 60-high pool got an 80-high pool with 40/40 lanes before any change)
lane actions check and preview on `opts.scene` but commit to `ctx.deps.scene` (A): fixed 7cf48b1125
addLane in a themed scene restyles locked lanes the lock check passed over (B): fixed 9d06e85c70
restackLocked compares round-tripped float poses exactly (B): fixed 3f6c553d8e

Extra defects:
pool layout resizes and stacks a non-lane child as a lane, while `lanesOf` and the lane layer pass over it (sweep): fixed eceb64ac7f
`addLane` lays a new lane past `trait.header` with no fallback, while the layout and lock check use `poolHeader(axis)` (sweep): fixed in ecc48d7d75, same commit as the header finding

Checks:
`npx vitest run --maxWorkers=1` on canDropInto.test.ts (14 passed), containers.scene.test.ts (26 passed), laneStack.test.ts (11 passed), containerLayout.test.ts (6 passed), containerActions.test.ts (22 passed), containerTheme.test.ts (5 passed): pass
`npm run checks:gate`: pass (all 32 passed)
`npm run check:changesets`: pass (OK, 105 changesets)
`npm run typecheck:packages -- diagram`: pass (1/1 diagram ok)
`npm run lint -w @weasel-js/diagram`: fail. The package has no lint script, only build and test. In its place, `npx eslint packages/diagram/src/containers` reported no errors, and the gate's `npm run lint` passed.

tally: 6 of 7 fixed, 1 extra fixed