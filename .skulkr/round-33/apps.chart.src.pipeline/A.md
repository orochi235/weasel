# Audit round 33, area `apps.chart.src.pipeline`: blind reviewer findings

Note: the brief's frozen commit d4226fab0e3e2669740411edb2a1d35dadeb46b1 does not exist in this clone
(`git cat-file` reports a bad object). These files were read from the working tree at HEAD 4c701b3803. None
of the listed files had uncommitted changes.

## Merging the image and audio runs drops the image run's `at`, so Step never outlines its stage in a pipeline with audio stages
- where: apps/chart/src/pipeline/pipelineAudio.ts:29 (mergeRuns)
- scenario: a pipeline holds image stages and at least one audio stage, e.g. an audio File stage with no source
  picked yet. Before any engine exists, `useFollowAudioRunner` returns `errorsRun(plan.errors)`, which has a stage
  entry for the File stage's "no source audio" error, so `hasStages(b)` is true. Run › Step makes the image runner
  publish `{ ...pass.run, at }` (packages/diagram/src/effect/runner/runner.ts:85). `mergeRuns` then returns
  `{ stages: { ...a.stages, ...b.stages } }`, which drops `at`, so the editor never draws the stepped stage
  outlined. Expected: the merged run keeps `a.at` (and `b.at`), as it does when one side is empty, where `a` is
  passed through whole.
- evidence: read
- severity: medium

## A param slider records its live preview values as undo steps, so a canceled drag leaves a no-op "Set <label>" step and a paused drag splits into several
- where: apps/chart/src/pipeline/ParamPanel.tsx:28-29 (ParamField, `number` case), with
  apps/chart/src/pipeline/usePipelineDoc.ts:58 (change)
- scenario: `onInput` goes to `change(..., coalesceKey)`, which pushes a history entry. The kit's edit protocol
  (docs/conventions.md, "Edit callbacks") says `onInput` is "a value to preview … never an undo step", and one edit
  commits once, at `onChange`. Two results follow:
  (a) Drag a slider, then press Escape. The control sends `onInput(startValue)` and then `onCancel`, and no
  `onChange` follows. The doc is back at the start value, but the undo stack holds a "Set <label>" entry that
  changes nothing. Undo then spends a press on it. Any redo stack was also cleared by the first `onInput`, even
  though the edit was abandoned.
  (b) Drag, hold the thumb still for more than 500 ms, then keep dragging. The coalesce window is measured from the
  top entry's last push (packages/history/src/history.ts:161, :190), so the second half becomes a separate undo
  step, and one drag takes two Undo presses.
  Expected: the preview goes through `onInput` without touching history, and `onChange` records one step. No
  `onCancel` is passed either.
- evidence: read
- severity: medium

## Source images are never closed: a replaced source, the test card, and the last source on unmount all leak their ImageBitmap
- where: apps/chart/src/pipeline/pipelineRun.ts:81 (Choose Source Image command), :64-69 (prime), :49 (sources state)
- scenario: Choose Source Image… sets `sources` to a new `ImageBitmap` without closing the one it replaces, which
  can be the 256 px test card from `prime` or an earlier pick. Leaving pipeline mode unmounts
  `PipelineWorkspace` and closes nothing either. The runner does not own sources: runPipeline only disposes the
  values a run made, and its previews are the caller's to close. Each pick of a large photo therefore keeps its
  decoded bitmap until GC finds it, and in Chrome a bitmap's backing memory is only freed promptly by `close()`.
  `chooseImage` already closes the bitmap of an overtaken pick (line 105), which shows the intent to manage this.
  Expected: close the previous source when it is replaced, and the current one on unmount.
- evidence: read
- severity: low

## Files read
apps/chart/src/pipeline/ParamPanel.tsx
apps/chart/src/pipeline/PipelineWorkspace.tsx
apps/chart/src/pipeline/StagePalette.tsx
apps/chart/src/pipeline/pipelineAudio.ts
apps/chart/src/pipeline/pipelineCommands.ts
apps/chart/src/pipeline/pipelineGroups.ts
apps/chart/src/pipeline/pipelineLook.ts
apps/chart/src/pipeline/pipelinePages.ts
apps/chart/src/pipeline/pipelineRun.ts
apps/chart/src/pipeline/usePipelineDoc.ts

<!-- done: 3 findings, files read: 10 -->
