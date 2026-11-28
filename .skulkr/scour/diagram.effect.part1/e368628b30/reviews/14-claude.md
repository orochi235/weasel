## nextStageId ignores cluster ids, so Add stage can mint a stage with a cluster's id
- where: packages/diagram/src/effect/edit.ts:15 (nextStageId)
- scenario: a pipeline has a cluster whose id equals a stage type's name (a custom type `cluster`, or a doc loaded with a cluster `audio.gain`), and `EffectEditorApi.addStage` is called with that type. `nextStageId` checks only stage ids, so the new stage gets the cluster's id. `uniqueClusters` then drops the cluster from every look, `checkPipeline` reports `duplicate-cluster`, and `editorScene.clusterOf` stops answering for it. `nextClusterId` already checks both sets; this one should too.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/edit.ts
- size: line
- cause: id minting checks one namespace of two
- confidence: sure

## typeColors spends a series color on every type that was given its own
- where: packages/diagram/src/effect/draw.ts:73 (typeColors)
- scenario: the colors are `{ image: '#fff' }` and the ports, in order, are `image` then `number`. `colors.size` counts `image`, so `number` gets `series[1]` and `series[0]` is never used. With one given type per pipeline, the documented "next in `series`" order is shifted by one for every given color before it.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/draw.ts
- size: line
- cause: series index counts given colors
- confidence: likely

## A delay's longest time is fixed when it is built, but time changes as a level
- where: packages/diagram/src/effect/audio/nodes.ts:87 ('audio.delay')
- scenario: `time` is a level, so editing it sends a `set` patch and never a rebuild. `createDelayNode` fixes `maxTime = max(2000, time)` when it is built. Built at 300 ms and then set to 5000 ms, the live graph clamps the delay at 2000 ms. After `reset`, or any rebuild of that node, the same pipeline plays a 5000 ms delay. One pipeline plays two ways depending on how it got there.
- evidence: read (processors.ts createDelayNode)
- severity: low
- fix: packages/diagram/src/effect/audio/nodes.ts
- size: function
- cause: build-time max for a live level
- confidence: likely

## checkPipeline does not flag a cluster that names the same member twice
- where: packages/diagram/src/effect/check.ts:139 (checkPipeline)
- scenario: a doc loaded with `clusters: [{ id: 'g', members: ['a', 'a'] }]` gets no problem reported, because `holder.get('a') === 'g'` skips the report. `dissolveCluster` then copies both entries into the parent cluster. The same id held by a second cluster is reported as `duplicate-member`; held twice by one cluster, it is not.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/check.ts
- size: line
- cause: same-holder repeat skipped
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

<!-- done: 4 findings, files read: 31 -->
