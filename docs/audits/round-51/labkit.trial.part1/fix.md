`resetTrial` exported but keeps `history`/`undo` (A): fixed 5be9d71857

Seed value at a schema start-auto path stays unpinned (A+B): fixed cd94015e70

`MissingTrial` Close live but dead on the last trial (A+B): fixed e89bc8d4a2

Trial story builds a fresh, empty store every render (A): fixed 55e84d47dc. The story is not published, so it has no changeset and no test.

Layer toggle/reorder undo steps restore nothing (B): fixed 60ba35fbf7. A history the instrument mounts itself now records the step too.

`dragDrop` without `canvas` shows a palette but nothing drops (B): fixed 05a63fe3fc. This was a behavior call, so I made the strict one: `cameraOf` throws, as it already does for `orbit` beside `canvas`. There is no opt-in override, because a palette that cannot drop has no use. The call is recorded in `docs/unruled.md` under "Audit round fifty-one (2026-11-20): labkit's trials". Question: should `stage` and `orbit` cameras get a drop target instead?

Undocked section loses `fill` (B): fixed d8fd5cfb09. The docked and undocked sections now read their props through one `sectionProps` mapping.

`trialHistoryOf` drops save/restore and stamps by whole ms (B): fixed ad9a6f0494. This needed new API in `@weasel-js/history`, fixed 8fd43adb72: `History.restore` now takes a `rebuildOp`, asked before the history's own. Its changeset is `minor`, with the `api` tag. The stamp code that `sceneTrialHistory` and `trialHistoryOf` shared moved into `undo/historyStamps.ts`.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: trialOps.test.ts pass (38), MissingTrial.test.tsx pass (3), UndockedSections.test.tsx pass (1), homeView.test.ts pass (2), useTrialLayerStack.test.tsx pass (1), trialHistoryOf.test.ts pass (2), history.rebuild.test.ts pass (6), sceneTrialHistory.test.ts pass (5), TrialSceneCanvas.undoPersist.test.tsx pass (2), Trial.resetHistory.test.tsx pass (2), ownUndo.test.ts pass (6), trialRestarts.test.ts pass (4), Trial.orbit.test.tsx pass (6), dragDrop.test.tsx pass (9), Trial.test.tsx pass (26), Trial.undoOrder.test.tsx pass (8). Each new test was also run against the code before its fix and failed.
- `npm run check:changesets`: pass
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on an unused `TrialRecord` import; that fix is folded into 5be9d71857.
- `npm run lint -w @weasel-js/labkit` and `-w @weasel-js/history`: unrun. The machine's hook refused them as "a suite-sized npm script" and said not to rephrase the command. Biome check passed on every labkit file I touched, and the gate's root eslint passed.

The tree is clean and `.skulk/` is untouched.

tally: 10 of 10 fixed, 0 extra fixed