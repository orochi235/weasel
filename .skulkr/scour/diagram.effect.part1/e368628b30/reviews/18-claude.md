## A live delay stage fails a `time` its own fresh build would accept, because the node's `maxTime` is fixed at build and later level changes go through `set`
- where: packages/diagram/src/effect/audio/nodes.ts:83 (audioStageNodes 'audio.delay'), packages/diagram/src/effect/audio/liveRunner.ts:211 (sync → applySets)
- scenario: a delay stage built with `time` 300 gets a node with `maxTime` max(2000, 300) = 2000 (`createDelayNode`, processors.ts:74). The user then sets `time` to 2500 (a typed param value or a doc value past the control's 2000 max). `time` is a level, so `diffPlans` sends a `set`, `fx.setTime` throws `delay time 2500 is outside 0..2000 ms` (effects.ts:141), and the stage shows that error and keeps its old time. A stage built from scratch at 2500 (reload, or `reset()`) gets `maxTime` 2500 and plays it. The same pipeline plays or fails depending on edit history; likewise a stage built at 2500 then set to 2600 fails.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/nodes.ts (pass a fixed `maxTime`, or treat `time` past the built max as a replace)
- size: line
- cause: build-time max baked into a node whose param later changes in place
- confidence: sure

## `clusterStages` drops a boxed cluster it empties, where `moveToCluster` keeps one
- where: packages/diagram/src/effect/clusterEdit.ts:88 (clusterStages)
- scenario: cluster G has a `clusterBoxes` entry (the user resized it) and holds only stage S; S is grouped with a top-level stage T. The parents differ, so `pruneClusters(clusters, taken)` runs with no `keep`, G is emptied and removed, and `withClusters` drops its box. Moving S out of G by drag (`moveToCluster`) keeps G because `boxed` says it has a box. Two paths answer "does an emptied boxed cluster survive" differently.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/clusterEdit.ts
- size: line
- cause: pruneClusters called without the boxed `keep` predicate
- confidence: likely

## `checkPipeline` never reports a cluster that lists the same member twice
- where: packages/diagram/src/effect/check.ts:141 (checkPipeline, duplicate-member)
- scenario: `{ id: 'g', members: ['a', 'a'] }`: the second 'a' finds `first === cluster.id` and is skipped, so no problem is reported, although `duplicate-member` exists for exactly this. Downstream edits then carry the repeat (`dissolveCluster` splices both copies into the parent's members; `clusterStages` keeps both), so `onProblems` stays silent about a malformed doc.
- evidence: read
- severity: low
- size: line
- cause: repeat check only compares against other clusters
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

<!-- done: 3 findings, files read: 31 -->
