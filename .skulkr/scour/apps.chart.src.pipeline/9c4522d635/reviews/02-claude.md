# Findings: apps.chart.src.pipeline

## Params sharing a label (and no id) collide: one edit rewrites both, and React sees duplicate keys
- where: apps/chart/src/pipeline/ParamPanel.tsx:77 (ParamPanel)
- scenario: a stage whose params include two without `id` and with the same `label` (loadable from a `.weaselpipeline.json`; `readEffectDoc` does not reject it) → the panel keys both rows `p.label`, so React warns about duplicate keys and can reuse one row's field state for the other; editing either calls `setParam(doc, stage, label, control)`, whose `addressed` matches every param with that label, so both params take the one control (an enum param can even receive a number control). Should address the param by position or a unique key.
- evidence: read (packages/diagram/src/effect/edit.ts:104 `addressed = (p.id ?? p.label) === key`)
- severity: low
- fix: apps/chart/src/pipeline/ParamPanel.tsx, packages/diagram/src/effect/edit.ts
- size: function
- cause: label used as identity
- confidence: likely

## Pipeline undo history is unbounded, each step holding whole EffectDocs
- where: apps/chart/src/pipeline/usePipelineDoc.ts:50 (usePipelineDoc)
- scenario: `createHistory(null)` passes no `historyLimit`, and `limitOf(undefined)` is `Infinity`; every slider commit, rename and stage edit pushes a swap op holding `before` and `after` docs (including decoded `places`, params, clusters). A long session — the doc is held above the mode switch so it lives as long as the app — grows without bound. Should pass a `historyLimit`.
- evidence: read (packages/history/src/history.ts:59-62)
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts
- size: line
- cause: no history cap
- confidence: sure

## `change` records an undo step even when the doc did not change
- where: apps/chart/src/pipeline/usePipelineDoc.ts:61 (change)
- scenario: File › New on a pipeline that is already the empty one (`emptyPipeline()` returns the shared `EMPTY`, so `before === after`), or renaming a group to its current name (`renameCluster` returns an equal new doc) → a 'New pipeline' / 'Rename group' step is pushed, Undo becomes enabled and does nothing visible, and the redo stack is cleared. Should skip recording when `next === before` (at least the identity case).
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts
- size: line
- cause: no no-op guard
- confidence: sure

## Autosave persists in-flight preview docs
- where: apps/chart/src/pipeline/usePipelineDoc.ts:58 (useAutosave revision: doc)
- scenario: while a param slider is dragged, `preview` sets `doc` to each intermediate value and autosave saves it; if the tab closes or reloads mid-drag (or the drag ends in a cancel that the autosave debounce misses), the stored pipeline holds a value the user never committed and that no undo step records. Save (pipelineCommands.ts `pipeline.doc`) likewise writes the preview. Should save `base.current ?? doc`.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts, apps/chart/src/pipeline/pipelineCommands.ts
- size: function
- cause: preview state not separated from committed doc
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

<!-- done: 4 findings, files read: 10 -->
