"Trial not found" placeholder offers a Close that does nothing (A+B): fixed bd659b3946. Close is now disabled with the reason "The lab holds no such trial", because there is no record for it to remove. The existing test that expected Close to fire for a missing record now expects it disabled.

Reset keeps the trial's mark undo history, while clone strips it (B): fixed 459e459444. Loading a snapshot had the same defect, and that is fixed too. Clone, reset, and snapshot load now share one `withoutUndo` helper in `trialOps.ts` that strips the saved mark history. `useTrialMarks` also listens for a trial restart and rebuilds its live mark store, without history, from the live marks rather than the saved ones. That covers marks kept in an instrument's own storage, and marks made within the 250 ms save delay before Reset. It also keeps the stripped record from dropping those unsaved marks.

Extra: none beyond the snapshot-load case above, which is part of the same fix.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/trial/MissingTrial.test.tsx`: pass (3/3)
- `npx vitest run --maxWorkers=1 packages/labkit/src/trial/Trial.resetHistory.test.tsx`: pass (4/4)
- `npx vitest run --maxWorkers=1 packages/labkit/src/trial/trialOps.test.ts`: pass (39/39)
- `npx vitest run --maxWorkers=1 packages/labkit/src/state/store.test.ts`: pass (33/33)
- Neighboring marks, undo, restart, snapshot, and reset test files, each on its own: pass
- `npm run checks:gate`: pass, all 33 passed (on the first run Biome flagged formatting in two files; I fixed it and reran)
- `npm run lint -w @weasel-js/labkit`: pass

tally: 2 of 2 fixed, 0 extra fixed