# Findings: diagram.effect.part1

## livePlan judges feedback loops over every raw wire, though it feeds stages only over wires the chart draws
- where: packages/diagram/src/effect/audio/plan.ts:54 (livePlan)
- scenario: `osc.out → gain.in` (audio) plus a stray wire `gain.out → osc.nope`, where `osc` has no input `nope` (checkPipeline reports `missing-port`, and no look draws it). `runOrder(pipeline)` counts every wire in `pipeline.wires`, so `osc` and `gain` form a cycle: both get the error "on a feedback loop" and neither plays. The same plan's `fromOutput` filter says "a wire from an output its stage has: the chart draws no other". The cycle test should be run over the wires the plan would actually feed through (drawable ones, with existing ports), not over raw wires. The same goes for a wire from a non-audio stage that is not in `stages`.
- evidence: read (plan.ts, runner/order.ts)
- severity: medium

## A numeric audio param without a `control` plays at its default, while a setting without one is used as written
- where: packages/diagram/src/effect/audio/plan.ts:38 (levelsOf); packages/diagram/src/effect/audio/nodes.ts:44 (node.settings)
- scenario: a doc read through `readEffectDoc` (where `control` is optional) has gain's param `{ label: 'gain', value: '0.2' }`. `paramValues` returns the display string `'0.2'`. `levelsOf` accepts only `typeof given === 'number'`, so it silently falls back to `levelDefaults` (1) and the stage plays at full gain with no error. By contrast, `settings` passes a display string straight through (`wave: 'square'` works). So the two halves of one stage answer "what does a param without a control mean" in two different ways. A level should parse the value, or fail the stage the way `settings` checks do.
- evidence: read (plan.ts, nodes.ts, runner/params.ts, docShape.ts)
- severity: low

## EffectEditorApi.dissolveCluster does not pin shown stages under nodeGraph, unlike cluster
- where: packages/diagram/src/effect/EffectEditor.tsx:154 (dissolveCluster in useImperativeHandle)
- scenario: under `nodeGraph`, a cluster holds stages that layout placed (they have no `places`). `cluster()` first runs `pinShown` "as a drag does" so nothing moves. `dissolveCluster()` reports `dissolveCluster(d, id)` without it. That removes the container that the layered layout ranked those stages inside, so the unplaced stages jump to new positions on the next layout. The `renameClusterContribution` path also edits without pinning, but that does not change layout membership. Expected behavior is the same as `cluster`: pin, then dissolve.
- evidence: read; that the layout moves the stages is inferred from `editorMapping.drawLook`, which turns clusters into containers that layout places around
- severity: low

## EffectEditorApi.cluster makes and reports a group of ids that name nothing
- where: packages/diagram/src/effect/EffectEditor.tsx:146 (cluster); packages/diagram/src/effect/clusterEdit.ts:73 (clusterStages)
- scenario: `ref.cluster(['nope'])`, or ids of a stage deleted since the caller read them. `clusterStages` never checks that the ids exist. It appends `{ id: 'cluster', members: ['nope'] }`, `onChange` hears 'Group', and the return value is the new id. `checkPipeline` then reports `missing-member` on the editor's own edit. The doc comment says it returns `null` "for no ids", so the call should drop unknown ids and treat an empty remainder as no ids.
- evidence: read
- severity: low

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
