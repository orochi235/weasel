## An edit that changes a live runner's errors drops every drawn preview from the published run
- where: packages/diagram/src/effect/audio/liveRunner.ts:211 (publishErrors, called from sync)
- scenario: previews set to 'scope', runner paused after playing (the last frame's scopes are shown). The user edits a param so that some stage now fails (or a failing stage recovers). `sync` → `publishErrors` publishes `errorsRun(next)`, which holds only errors, so every stage's scope preview vanishes and stays gone until `play` restarts `frame()`. While playing, the same edit blanks the previews for a frame. It should republish the errors over the previews already shown, e.g. through `previews.draw(next)` when taps exist, as `frame()` does.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/liveRunner.ts
- size: line
- cause: errors-only run replaces preview run
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
