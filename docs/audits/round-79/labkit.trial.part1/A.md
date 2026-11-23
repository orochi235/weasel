## A "Trial not found" placeholder offers an enabled Close that does nothing
- where: packages/labkit/src/trial/Trial.tsx:46 (Trial), packages/labkit/src/trial/MissingTrial.tsx:27 (MissingTrial)
- scenario: `<Trial id>` renders for an id with no record in `s.trials` (a workspace tile whose record has gone). It renders `<MissingTrial id={id}>` without `isLastTrial`, so Close is enabled. Clicking it calls `lab.closeTrial(id)`, which in `lab/storeCommands.ts:75` removes the trial only when `closeTrialOp(trials, id) !== trials`. `trialOps.closeTrial` returns the same array when the id is not in it, so `removeTrial` never runs and the click is silently a no-op. The component's own doc says it "carries the close the chrome would", so this case should either close the tile or not offer the button.
- evidence: read (Trial.tsx, MissingTrial.tsx, trialOps.ts closeTrial, storeCommands.ts:72-76). Whether `ids` can outlive the record for more than one render was not traced (TrialWorkspace takes `ids` from its caller).
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

<!-- done: 1 findings, files read: 27 -->
