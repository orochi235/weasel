## EffectEditor's `renaming` state outlives the cluster it names, so a later cluster minted with the same id opens the rename field unasked
- where: packages/diagram/src/effect/EffectEditor.tsx:146 (EffectEditor, `renaming` state) with packages/diagram/src/effect/clusterTitle.tsx:36-50 (useClusterTitle)
- scenario: `renameCluster('cluster')` opens the field. While it is open, the cluster goes away: an undo, an `api.dissolveCluster`, or an external `doc` change. `useClusterTitle` finds no cluster and returns null, so the `<input>` unmounts. React fires no `onBlur` on unmount, so `finish` never runs and `setRenaming(null)` is never called, and `renaming` stays `'cluster'`. The next `cluster(ids)` mints `nextClusterId` = `'cluster'` again, which is free now, and the rename field pops up over the new group with focus taken. It should only open on a double-click or `renameCluster`. Clear `renaming` when its cluster leaves the doc.
- evidence: read
- severity: low

## Remaking the live audio runner closes the bitmaps of the run still on screen before the new runner's state renders
- where: packages/diagram/src/effect/audio/useLiveAudioRunner.ts:28-38 (useLiveAudioRunner effect cleanup) with packages/diagram/src/effect/audio/livePreviews.ts:79-83 (dispose)
- scenario: Previews are on and playing, and the caller changes `engine`, `bus` or `nodes`. At that commit the effect cleanup runs `made.dispose()` → `previews.dispose()` → `closeBitmaps(published.flatMap(previewsOf))`, which includes the run the chart is drawing right now. The new runner is published only by `setRunner(made)` inside the new effect, so until that re-render the chart still holds `live.run` from the old runner, whose `ImageBitmap`s are closed. A repaint or texture upload in that window draws a closed bitmap (an InvalidStateError, or an empty preview). The old run's bitmaps should be closed only once a render no longer shows them, which is what `drawn` is for.
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

<!-- done: 2 findings, files read: 31 -->
