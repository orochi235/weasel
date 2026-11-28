## An edit to an audio stage or a group drops the image runner's stepped pass
- where: apps/chart/src/pipeline/pipelineRun.ts:56 (usePipelineRun, `split = useMemo(() => splitDomains(pipeline), [pipeline])`)
- scenario: Run › Step the image stages to the third stage, then change an audio stage's param (or rename a group, since clusters live on `pipeline`). `splitDomains` builds a new `split.image` object although its stages and wires are unchanged; `useEffectRunner` calls `runner.setPipeline(split.image)`, which compares by identity and calls `dropStepping()`, so the next Step starts again from the first stage. An audio slider drag does this every input tick. Edits outside the image half should leave the image runner's pipeline identity alone (and vice versa for the audio runner's `setPipeline`, which re-syncs its graph on every image edit).
- evidence: read (packages/diagram/src/effect/runner/runner.ts:179-183, useEffectRunner.ts:32, pipelineAudio.ts:14-21)
- severity: low
- fix: apps/chart/src/pipeline/pipelineAudio.ts
- size: function
- cause: split rebuilt on every pipeline identity change
- confidence: likely

## change() records an undo step for an edit that changes nothing
- where: apps/chart/src/pipeline/usePipelineDoc.ts:61 (usePipelineDoc, `change`)
- scenario: open pipeline mode with nothing stored (doc is the shared `EMPTY`), choose File › New: `change(emptyPipeline(), 'New pipeline')` applies a swap op whose `before` and `after` are the same object. Edit › Undo is now enabled and reads "Undo New pipeline", and undoing it does nothing visible; it also clears the redo stack. Same for any `change` whose `next` is the current doc. `change` should skip `history.apply` when `next === before` (after clearing `base`).
- evidence: read (createSwapOp has no equality guard, packages/history/src/createSwapOp.ts:23-33)
- severity: low
- size: line
- cause: no no-op guard before history.apply
- confidence: sure

## Autosave stores a param preview that was never committed
- where: apps/chart/src/pipeline/usePipelineDoc.ts:59 (usePipelineDoc, `useAutosave` keyed on `doc`)
- scenario: drag a number param's slider in ParamPanel: each `onInput` calls `preview`, which `emit`s into `doc`, and autosave writes that doc under `weaselchart:pipeline-v1`. Close or reload the tab mid-drag (or before Escape cancels it) and the reload opens on a value the user never committed or that Escape would have reverted. Autosave should store `base.current ?? doc` (the committed doc) while a preview is on screen.
- evidence: read
- severity: low
- size: function
- cause: autosave reads the preview doc, not the committed one
- confidence: likely

## Files read
apps/chart/src/pipeline/ParamPanel.tsx
apps/chart/src/pipeline/PipelineWorkspace.tsx
apps/chart/src/pipeline/StagePalette.tsx
apps/chart/src/pipeline/pipelineAudio.ts
apps/chart/src/pipeline/pipelineClusters.ts
apps/chart/src/pipeline/pipelineCommands.ts
apps/chart/src/pipeline/pipelineLook.ts
apps/chart/src/pipeline/pipelinePages.ts
apps/chart/src/pipeline/pipelineRun.ts
apps/chart/src/pipeline/usePipelineDoc.ts

<!-- done: 3 findings, files read: 10 -->
