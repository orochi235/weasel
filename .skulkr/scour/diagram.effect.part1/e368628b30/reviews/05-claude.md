# Findings: diagram.effect.part1

## Live audio previews always land on port `out`, whatever the stage's output is called
- where: packages/diagram/src/effect/audio/livePreviews.ts:73 (createLivePreviews → draw)
- scenario: a caller passes its own `nodes` (`LiveAudioRunnerOptions.nodes`, `AudioStageNodes` keyed by any stage type) for a stage whose output port is `signal`, not `out`. While playing with previews on, every frame draws a bitmap into `stages[id].previews.out`. The look keeps its preview slot under `previewRowId('signal')`, so nothing ever shows in that slot. A new bitmap is still made every frame for a key nobody reads. The preview should go to the stage's shown port (its first output, as `shownPorts` gives).
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/livePreviews.ts, packages/diagram/src/effect/audio/liveRunner.ts
- size: function
- cause: port id hard-coded; previews never see the pipeline
- confidence: likely

## A bypassed stage whose ports are not typed `audio` cuts the signal instead of passing it on
- where: packages/diagram/src/effect/audio/plan.ts:73 (livePlan)
- scenario: with custom `nodes`, a stage type whose ports are typed something else (e.g. `signal`) sits mid-chain and has `bypassed: true`. `firstAudio` is `undefined`, so `fed` keeps only wires where `w.to.port === undefined`, which is none. The stage has inputs and nothing fed, so the plan `continue`s without setting `origins`. Everything downstream then has no origin and is left out, so bypassing the stage silences the chain. It should carry its first input through. `played` itself never checks port types, so these stages otherwise play normally.
- evidence: read
- severity: low
- size: line
- cause: bypass pass-through keyed to the literal port type 'audio'
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

<!-- done: 2 findings, files read: 31 -->
