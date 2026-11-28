# Findings: diagram.effect.part1

## The live audio runner draws every scope and spectrum at the default 48-unit size, ignoring the look's `previewSize`
- where: packages/diagram/src/effect/audio/livePreviews.ts:74 (createLivePreviews → draw)
- scenario: a chart or editor whose look sets `showPreviews: true, previewSize: { width: 160, height: 48 }` (or `96`) shows a live audio pipeline from `useLiveAudioRunner`. The slot is laid out at 160×48, but `draw` paints each tap at `PREVIEW_SIZE` × `PREVIEW_SIZE` (48×48 → 96×96 device px), so the bitmap is stretched: a wide slot gets a distorted waveform, and a larger square slot gets a blurry one. The image runner takes the same setting as an option (`runner/pass.ts:23`, `useEffectRunner`'s `previewSize`). `LiveAudioRunnerOptions`/`UseLiveAudioRunnerOptions` have no matching field, so the option is dropped on this path.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/livePreviews.ts, packages/diagram/src/effect/audio/liveRunner.ts, packages/diagram/src/effect/audio/useLiveAudioRunner.ts, packages/diagram/src/effect/audio/useFollowAudioRunner.ts
- size: function
- cause: preview size hard-coded; no option threaded through
- confidence: sure

## `nextStageId` ignores cluster ids, so a new stage can take an existing cluster's id and remove that cluster from the drawing
- where: packages/diagram/src/effect/edit.ts:16 (nextStageId); used by packages/diagram/src/effect/EffectEditor.tsx:173 (addStage)
- scenario: a doc has a cluster with id `blur` (a loaded file, or `clusterStages` called with a caller-chosen doc). `EffectEditorApi.addStage(blurType)` mints the stage id `blur` because `nextStageId` checks stage ids only. Now `checkPipeline` reports `duplicate-cluster` ("has the id of a stage"), `uniqueClusters` drops the cluster, and `editorMapping.clusterOf` stops answering for it. The cluster's box and grouping vanish from every look. `nextClusterId` makes the opposite choice: it avoids both stage and cluster ids. The question "is this id free?" gets two different answers.
- evidence: read
- severity: low
- size: line
- cause: id freshness checked against stages only
- confidence: sure

## A structural batch the graph refuses also blocks every param write in the same sync, and in every later sync until the structure changes
- where: packages/diagram/src/effect/audio/liveRunner.ts:237 (createLiveAudioRunner → sync)
- scenario: the graph refuses a structural patch during `graph.check`, for example a custom `AudioStageNode.build` that hands back a def already in use (`defInUse`). `landed` is then false, so `sets` is `[]` and `plan` stays `from`. Every later `setPipeline` re-diffs from that same `from`, rebuilds the same refused structure, and is refused again. While that persists, no level change to any other stage reaches the graph. If `failingStage` finds no quoted id in the message, no stage gets an error either, and the only sign is a `console.warn`. Sets on nodes that are unchanged in both plans could still be applied.
- evidence: read
- severity: low
- size: function
- cause: param writes gated on the whole structural batch landing
- confidence: likely

## Files read
packages/diagram/src/effect/EffectChart.tsx
packages/diagram/src/effect/EffectEditor.tsx
packages/diagram/src/effect/audio/livePreviews.ts
packages/diagram/src/effect/audio/liveRunner.ts
packages/diagram/src/effect/audio/nodes.ts
packages/diagram/src/effect/audio/patches.ts
packages/diagram/src/effect/audio/plan.ts
packages/diagram/src/effect/audio/scope.ts
packages/diagram/src/effect/audio/stageTypes.ts
packages/diagram/src/effect/audio/useFollowAudioRunner.ts
packages/diagram/src/effect/audio/useLiveAudioRunner.ts
packages/diagram/src/effect/chainEdit.ts
packages/diagram/src/effect/check.ts
packages/diagram/src/effect/clusterEdit.ts
packages/diagram/src/effect/clusterHandlers.ts
packages/diagram/src/effect/clusterOrder.ts
packages/diagram/src/effect/clusterTitle.tsx
packages/diagram/src/effect/compact.ts
packages/diagram/src/effect/docShape.ts
packages/diagram/src/effect/draw.ts
packages/diagram/src/effect/edit.ts
packages/diagram/src/effect/editorHandlers.ts
packages/diagram/src/effect/editorMapping.ts
packages/diagram/src/effect/editorPicks.ts
packages/diagram/src/effect/editorReorder.ts
packages/diagram/src/effect/glyphs.ts
packages/diagram/src/effect/image/evaluators.ts
packages/diagram/src/effect/image/stageTypes.ts
packages/diagram/src/effect/image/testCard.ts
packages/diagram/src/effect/image/valueKinds.ts
packages/diagram/src/effect/lab/EffectLab.stories.module.css

<!-- done: 3 findings, files read: 31 -->
