## Autosave persists a param preview as if it were committed
- where: apps/chart/src/pipeline/usePipelineDoc.ts:59 (usePipelineDoc)
- scenario: dragging a number param's slider calls `preview`, which `emit`s a new `doc` on every input; `useAutosave` keys its revision on `doc`, so each previewed value is written to `weaselchart:pipeline-v1`. Reload (or crash) mid-drag, or press Escape after a save fired: storage holds the uncommitted value, which then loads as the document with no undo step behind it, although `cancel` put the screen back. Autosave should save the committed doc (`base.current ?? doc`), not the preview.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts
- size: line
- cause: autosave revision includes previews
- confidence: likely

## New on an already-empty pipeline records an undo step that changes nothing
- where: apps/chart/src/pipeline/usePipelineDoc.ts:61 (change); apps/chart/src/pipeline/pipelineCommands.ts:51
- scenario: `emptyPipeline()` returns the shared `EMPTY` constant, so File › New twice (or New on a fresh doc) calls `change(EMPTY, 'New pipeline')` with `before === after`; `change` applies a swap op regardless, so Undo is enabled and its first press does nothing visible. `change` should skip when `next` is the doc it would record from.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/usePipelineDoc.ts
- size: line
- cause: no identity check before recording a step
- confidence: likely

## Add Page / Delete Page stay enabled under Rack and Lanes, which ignore pages
- where: apps/chart/src/pipeline/pipelinePages.ts:17 (usePipelinePageCommands)
- scenario: `EffectDoc.pages` is drawn only under `nodeGraph` (types.ts: "The other looks ignore them"). With View › Look › Rack on, Page › Add Page is enabled and records an 'Add Page' undo step that changes nothing on screen; Delete Page likewise silently drops a page the user cannot see. Both should be disabled unless the look is `nodeGraph`, as Rack Direction is gated on `rack` in pipelineLook.ts.
- evidence: read
- severity: low
- fix: apps/chart/src/pipeline/pipelinePages.ts, apps/chart/src/pipeline/PipelineWorkspace.tsx
- size: function
- cause: command not gated on look
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
