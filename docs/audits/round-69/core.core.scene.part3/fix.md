- `staleReplay` throws on `kit:setLod` for a removed node instead of skipping it (A): fixed 4483dd86f0. The declared-field and flag kinds now come from the tables that register them, so a kind added to those tables later is covered too.
- `changesSince` leaves out the dependents of a node that left the scene (A): fixed 3f92d3aea1. Covers undo of an add and a plain remove.
- Replaying `kit:move` or `kit:add` after an untracked edit can make a cycle or put a child below its parent's layer (B): fixed 975ff0fed1. It also covers re-attaching a removed node on undo. `kit:setLayer` is left unchecked on purpose: a subtree relayer batch is briefly below its parent's layer on every replay, so a floor check would skip legitimate undos.
- The feed notes the parent from the payload, not the one the node actually leaves, on `kit:add`, `kit:move`, and `kit:remove` (B): fixed 00aaf6cd77. A new `touching` hook in the op table and the applied log runs before every op on every path, and records the parent each node leaves at that moment.
- `loadState` trims a session's selection without telling its subscribers (B): not a defect. A session's `subscribe` also subscribes to the scene, and `loadState` notifies the scene once. The session's `getVersion` is built on the scene's version, so it moves too.
- `setChildOrder` reorders an id that belongs to another parent (B): fixed 8afc5e0f1a. A foreign id or a repeated one now throws before anything is written. The adapter contract already requires the parent's own children, so no `docs/unruled.md` entry was needed.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/scene.staleReplay.test.ts`: pass (16)
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/sceneTouches.test.ts`: pass (15)
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/sceneMutators.test.ts`: pass (1, new file)
- `npx vitest run --project=core packages/core/src/core`: pass (191 files, 1778 tests)
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed `check:changesets` on five titles over 140 characters; I shortened them and folded each fix into its own commit.
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. `npx eslint` on every changed file: pass.

tally: 5 of 6 fixed, 0 extra fixed