Path-effect cache ignores the node-memo generation, so a painter change leaves the old outline (A): fixed 179e53ac4c

reconcileSpecs retargets `foundHidden` a second time when `next` changes both data and `dependsOn` (A): fixed 637561b9bd

Pose feed misses an override pose mutated in place and committed (A+B): fixed 6cd27129b1

Undoing an unhide or unlock leaves the node selected (B): fixed a9536ff8be. Undo restores its own session's selection, so the bug only shows in another editing session's selection. The test covers that case.

Undoing a layer show or unlock leaves its nodes selected (B): fixed 6862ba58ff. This is in `layerOps.ts`, the twin of the node-flag fix and the same mistake.

Under `muted`, settled callbacks run before the scene's subscribers hear of the change (B): fixed 2b77549eb1. `notify` now runs the settled set after its subscribers. `muted` leaves the set for its caller's notify, and every caller notifies right after. It still flushes itself if `fn` throws.

reconcileSpecs brings back a node the scene deleted while its spec stayed unchanged (B): not a defect. The existing test "re-adds a node the scene lost" in `reconcileSpecs.test.ts` pins this as intended.

Extra: none. 17ad5ea86a only shortens four of the changesets above to the 140-character title limit.

Checks:
- `npx vitest run --maxWorkers=1` on `pathEffects/derive.test.ts` (new): pass
- `reconcileSpecs.test.ts`: pass
- `poseFeed.test.ts`: pass
- `scene.nodeFlags.test.ts`: pass
- `notifier.test.ts`: pass
- `scene.history.test.ts`, `scene.historyPersistence.test.ts`, `poseOverrides.test.ts`, `scene.overrides.test.ts` (not touched, run for the notifier change): pass
- `npx vitest run --maxWorkers=1 --project=core packages/core/src/core/scene`: pass (97 files, 937 tests)
- `npm run check:changesets`: pass (failed first on four titles over 140 characters, fixed in 17ad5ea86a)
- `npm run checks:gate`: pass ("all 32 passed")
- `npm run lint -w @weasel-js/core`: fail, `Missing script: "lint"` (core has no lint script). `npx eslint` on every changed file: pass, no output.
- Tree clean except `.skulkr/`.

tally: 6 of 8 fixed, 0 extra fixed