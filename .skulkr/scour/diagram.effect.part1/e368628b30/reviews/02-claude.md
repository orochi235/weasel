# diagram.effect.part1 — blind review findings

## nextStageId mints an id a cluster already has, so adding a stage makes that cluster vanish
- where: packages/diagram/src/effect/edit.ts:17 (nextStageId)
- scenario: a doc has a cluster whose id is `blur` (or `audio.gain`, any id equal to a stage type name; clusters from a loaded file can be named anything). `EffectEditorApi.addStage(blurType)` calls `nextStageId(d.pipeline, 'blur')`, which checks only `p.stages`, so the new stage gets id `blur`. Now a stage and a cluster share an id: `checkPipeline` reports `duplicate-cluster` ("has the id of a stage"), `uniqueClusters` drops the cluster from every look, and `editorScene.clusterOf` answers `undefined` for it, so the user's group disappears and can no longer be edited. It should have minted `blur-2`, as `nextClusterId` already does in the other direction by excluding stage ids.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/edit.ts
- size: line
- cause: id-taken set omits cluster ids
- confidence: sure

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

<!-- done: 1 findings, files read: 31 -->
