## A wire id equal to a stage or cluster id makes every look's scene throw, and checkPipeline never reports it
- where: packages/diagram/src/effect/draw.ts:166 (drawableWires)
- scenario: a pipeline (loaded through `readEffectDoc`, or hand-built) with a stage `w1` and a wire whose id is `w1`, or a stage named `w1` and an id-less wire that `ensureWireIds`/`nextWireId` mints as `w1` (both only avoid other wires' ids). `drawableWires` keeps the wire with its id, `wireEdges` hands it to `diagramScene` as edge id `w1`, and `diagramScene` throws "two things would share the scene id" (fromData.ts:249), so `EffectChart`/`EffectEditor` crash on render. `checkPipeline` reports duplicate wire ids but not a wire id shared with a stage or cluster, so `onProblems` never names the cause. Should: report it as a problem and have drawableWires drop the clashing id as it does for a repeated wire id, and have `nextWireId`/`ensureWireIds` avoid stage and cluster ids.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/draw.ts, packages/diagram/src/effect/check.ts, packages/diagram/src/effect/edit.ts
- size: function
- cause: wire ids checked only against wire ids
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

<!-- done: 1 findings, files read: 31 -->
