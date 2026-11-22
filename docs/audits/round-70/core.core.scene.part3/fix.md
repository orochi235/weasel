Redo of a removal ran after an untracked edit moved an inner node of the removed subtree out of it, leaving a dangling child id (A): fixed e101a6a781

A replayed `kit:setLayer` was not checked against the layer floor, so a child could end up below its parent (A+B): fixed 9c8a45f8ef. The fix also changes how `setLayer` records a whole subtree. Lowered nodes are recorded top-down and raised ones bottom-up, so the new check never skips a step of a normal subtree undo or redo. Tests cover a subtree replayed both ways, including one where some nodes rise and others drop.

`Scene.childrenOf` doc said a mark has no children (B): fixed b4293ba431. It is a doc-only change, so no test can fail before it.

`foldable` let NaN poses from a localized version 1 or 2 save past its check (B): fixed 901f953f26

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/scene.staleReplay.test.ts`: Tests 21 passed (21)
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/loadScene.composition.test.ts`: Tests 6 passed (6)
- Related files also passed: renderOrder, scene.derived, scene.history, scene.lock, scene.nodes, scene.layers, scene.replay, sceneLongRun.pbt, sceneTouches, scene.serialization, serialization.v1, serialization.upgrade, scene.loadState, and serialization.pbt.
- `npm run check:changesets`: [changesets] OK — 298 changeset(s).
- `npm run checks:gate`: checks:gate: all 33 passed
- `npm run lint -w @weasel-js/core`: not run. `@weasel-js/core` has no `lint` script, so npm refused it. The root `npm run lint` passed inside the gate.

tally: 4 of 4 fixed, 0 extra fixed