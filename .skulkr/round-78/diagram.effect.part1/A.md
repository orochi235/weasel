# Audit round 78 — diagram.effect.part1 (blind reviewer)

## A replaced runner's last preview bitmaps can be closed while a render still shows them
- where: packages/diagram/src/effect/audio/useLiveAudioRunner.ts:45 (useLiveAudioRunner, the `closeRetired` effect)
- scenario: previews are on and the graph is playing, so `frame()` publishes a new run every frame. The parent re-renders with a new `engine`, `bus` or `nodes`, and that render also reads a newer `state.run` from the old runner, because an emit landed since the last commit. In that commit the creation effect's cleanup disposes the old runner and pushes it onto `retired`. Then the `closeRetired` effect runs, since its deps `[runner, state.run]` changed through `state.run`, even though `runner` is still the old one. `drawn(undefined)` closes every bitmap the old runner published, including the run this commit just rendered. Until the new runner's state renders, the chart paints closed `ImageBitmap`s. The hook's own doc says a replaced runner's previews are closed "once a render shows the new one's". The effect only checks `runner !== null`, so it should run only once `runner` is no longer a retired one.
- evidence: inference, from the effect order and deps in this file; not run
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

<!-- done: 1 findings, files read: 31 -->
