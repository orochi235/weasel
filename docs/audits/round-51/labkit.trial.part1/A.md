# Audit round 51 — labkit.trial.part1

## The exported `resetTrial` keeps the trial's undo `history` and `undo`, which the store's Reset strips
- where: packages/labkit/src/trial/trialOps.ts:130 (resetTrial)
- scenario: a consumer calls the public `resetTrial(trials, id, instruments)` (exported from `trial/index.ts`) on a trial that has a live `history` / saved `undo`. Only `auto` is stripped (`const { auto: _unpinnedNow, ...kept } = current`), so the reset record still carries the pre-reset history: its Undo steps back to the state before Reset, and a save writes that history beside the fresh state. The store's own reset (`state/snapshotActions.ts:71`) strips `auto`, `history` and `undo`, and `TrialRecord.history` documents it as "Absent on a new, cloned, reset or reloaded trial". One decision answered two ways; the public helper should drop `history` and `undo` as Clone and the store do.
- evidence: read
- severity: medium

## A seed config's concrete value at a path the schema starts auto is ignored: the path stays unpinned
- where: packages/labkit/src/trial/trialOps.ts:74 (addTrial; same at :129 in resetTrial)
- scenario: an instrument declares `cols: f.number(3).initial(AUTO)`, and a lab opens a trial on a subject with `addTrial(trials, instruments, 'X', { config: { cols: 8 } })`. `splitAutoSeed` puts `cols: 8` in `seeded.config`, but `autoPaths` is `schemaAutoPaths ∪ seeded.autoPaths`, so `cols` is still in `record.auto` and the instrument reads the resolver's value (or `undefined`) rather than 8; the 8 only survives as the value the field would pin back to. `AddTrialOptions.config` promises the trial "is running that subject from its first frame". A path the seed sets to a concrete value should be removed from the schema's start-auto set (in `addTrial`, and so in `resetTrial`, which rebuilds the set the same way from `configSeed`).
- evidence: read
- severity: medium

## `MissingTrial`'s Close does nothing when it stands in for the lab's only trial
- where: packages/labkit/src/trial/MissingTrial.tsx:13 (MissingTrial)
- scenario: a saved layout holds one trial whose instrument was since renamed, so `<Trial>` renders `Unknown instrument: …` with a Close button. `lab.closeTrial(id)` goes to `closeTrial` (`trialOps.ts:111`), which returns the list unchanged when `trials.length <= 1`, so the press does nothing and the stand-in offers no other way out. The real chrome answers the same question by disabling Close on the last trial (`chrome/trialActions.tsx:106`, `disabled: ctx.isLastTrial`); here the button stays live and dead. It should be disabled for the last trial, or, better, swap the trial for one the lab can run.
- evidence: read
- severity: low

## The Trial story builds a fresh lab store every render, and the store never holds the trial it shows
- where: packages/labkit/src/trial/Trial.stories.tsx:26 (Harness)
- scenario: `createLabStore()` runs in `Harness`'s render body, so any re-render (an args change, HMR) hands `TrialChrome` a new empty store. That store has no `ws-demo` record at all, so every write the chrome makes goes to a trial that is not there: dragging the sidebar seam (`updateTrialSidebarWidth`), folding a section, retitling, or switching color mode is dropped, and the chrome keeps rendering the static `record` const. The store should be made once (`useState(createLabStore)`) and seeded with `record`, and the chrome fed the record read back from it.
- evidence: read
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

<!-- done: 4 findings, files read: 27 -->
