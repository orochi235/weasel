## "Trial not found" placeholder offers a Close that can never close it
- where: packages/labkit/src/trial/Trial.tsx:45 (Trial) with packages/labkit/src/trial/MissingTrial.tsx:26 (MissingTrial)
- scenario: a `<Trial id>` whose record is gone from the store (a tile or saved layout naming a removed trial) renders `MissingTrial` with Close enabled (`isLastTrial` not passed, though `isLast` is computed above). Pressing it calls `lab.closeTrial(id)`; `storeCommands.closeTrial` (packages/labkit/src/lab/storeCommands.ts:75) only calls `removeTrial` when `closeTrialOp` changes the list, and `closeTrialOp` returns the same array for an id it does not hold, so nothing happens. The button is offered enabled and does nothing; it should either remove the stale tile or not be offered.
- evidence: read
- severity: low

## Reset keeps the trial's mark history, while clone strips it
- where: packages/labkit/src/trial/trialOps.ts:148 (resetTrial) vs :119 (cloneTrial)
- scenario: `cloneTrial` passes `annotations` through `withoutMarkHistory` so the copy "starts with an empty undo history"; `resetTrial`, documented as "starting its undo afresh", drops `history` and `undo` but keeps `annotations` whole, mark history included. After Reset (or a reload of the reset record), Undo can still take back marks made before the reset. Two answers to "what does a fresh undo drop". Inference: I did not confirm whether `restarted(trialId)` (packages/labkit/src/state/snapshotActions.ts:68) clears the live mark history separately; if it does not, the persisted record keeps it either way.
- evidence: read (the restart path is inference)
- severity: low

## Files read
packages/labkit/src/trial/FloatSidebar.tsx
packages/labkit/src/trial/MissingTrial.tsx
packages/labkit/src/trial/Trial.less
packages/labkit/src/trial/Trial.stories.tsx
packages/labkit/src/trial/Trial.tsx
packages/labkit/src/trial/TrialBody.tsx
packages/labkit/src/trial/TrialChrome.tsx
packages/labkit/src/trial/TrialContexts.tsx
packages/labkit/src/trial/TrialDragContext.ts
packages/labkit/src/trial/TrialLayerList.tsx
packages/labkit/src/trial/TrialScope.tsx
packages/labkit/src/trial/TrialTheme.tsx
packages/labkit/src/trial/TrialTitleBar.tsx
packages/labkit/src/trial/UndockedSections.tsx
packages/labkit/src/trial/homeView.ts
packages/labkit/src/trial/index.ts
packages/labkit/src/trial/loupeSwitch.ts
packages/labkit/src/trial/renderContext.ts
packages/labkit/src/trial/trialConfigChange.ts
packages/labkit/src/trial/trialContent.tsx
packages/labkit/src/trial/trialEdit.ts
packages/labkit/src/trial/trialEditOp.ts
packages/labkit/src/trial/trialHistory.ts
packages/labkit/src/trial/trialHistoryOf.ts
packages/labkit/src/trial/trialOps.ts
packages/labkit/src/trial/trialTitle.ts
packages/labkit/src/trial/trialUndo.ts

<!-- done: 2 findings, files read: 27 -->
