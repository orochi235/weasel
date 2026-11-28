# Findings: apps.chart.src.pipeline

## Pipeline undo history has no bound: every committed edit keeps a full EffectDoc forever
- where: apps/chart/src/pipeline/usePipelineDoc.ts:50 (usePipelineDoc)
- scenario: `createHistory(null)` with no `historyLimit` resolves to `Infinity` (packages/history/src/history.ts:59-61). Each slider release, rename, add or Open pushes a swap op holding `before` and `after` docs. The doc is held above the mode switch for the whole session, so a long editing session (or many Opens of large pipelines, which share no structure) grows memory without limit. The other apps' histories (theme-editor's `useLabHistory`, `usePrefsHistory`) pass a `HISTORY_LIMIT`.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts
- size: line
- cause: cache without a bound (no historyLimit)
- confidence: sure

## A source image overtaken by a later pick still reports its decode failure
- where: apps/chart/src/pipeline/pipelineRun.ts:128 (chooseImage)
- scenario: the user picks a large or corrupt image, then picks another before the first decodes. If `createImageBitmap(file)` for the first rejects, the rejection propagates before `mine()` is checked, and Choose Source Image's `.catch(reportFailure('Could not read the image'))` shows an error for a pick the user has already replaced. `usePipelineAudio.chooseSource` handles the same case (`if (!current()) return;` in its catch), so the two source pickers answer "is an overtaken pick's failure reported" two different ways.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/pipelineRun.ts
- size: function
- cause: overtaken check skipped on the error path
- confidence: sure

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

<!-- done: 2 findings, files read: 10 -->
