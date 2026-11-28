# Findings: diagram.effect.part1

## `play()` leaves `playing: false` while the graph's other sources sound when one source fails to start
- where: packages/diagram/src/effect/audio/liveRunner.ts:247 (createLiveAudioRunner `play`)
- scenario: a pipeline with two sources, one of whose `start` throws (an `AudioGraph.start` contract case: "A source whose start throws is left stopped while the rest start, and the first error is rethrown"). `play()` calls `graph.start()`, which throws after starting the other sources, so `set({ playing: true })` never runs and the promise rejects. The graph is audibly playing, but `state.playing` is false: `useFollowAudioRunner` never starts its preview loop, a UI shows a Play button for sound already playing, and the failing stage gets no error in the run. It should publish `playing: true` (the graph is running) and report the failed stage under `errors`, as `applyStructure` does for a source that fails to start.
- evidence: read (graph/types.ts `start` doc; liveRunner `play`)
- severity: medium
- fix: packages/diagram/src/effect/audio/liveRunner.ts
- size: function
- cause: exception from a partial start skips the state update
- confidence: likely

## An edit that changes the errors while paused wipes every scope or spectrum preview until play
- where: packages/diagram/src/effect/audio/liveRunner.ts:212 (createLiveAudioRunner `publishErrors`)
- scenario: previews set to 'scope', play, then pause: the last frame's run (with previews) stays shown. Now edit the pipeline so a stage's error appears or clears (e.g. wire a stage to a port it lacks, or fix one). `sync` calls `publishErrors`, which publishes `errorsRun(next)`, a run holding only errors, so every preview slot goes blank. `frame()` only runs while playing, so they stay blank until play is pressed. Paused previews should keep their last frame with the new errors laid over it, as `draw(errors)` does while playing.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/liveRunner.ts, packages/diagram/src/effect/audio/livePreviews.ts
- size: function
- cause: errors-only run replaces the preview run
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
