## A paused live runner drops every stage's preview whenever its errors change
- where: packages/diagram/src/effect/audio/liveRunner.ts:226 (publishErrors, inside createLiveAudioRunner)
- scenario: previews 'scope', the graph plays, then pauses; the last published run holds every tapped stage's scope bitmap. An edit that changes the error set (a filter type made invalid, a stage wired into a loop) calls `publishErrors`, which publishes `errorsRun(next)`, a run of errors alone. `useFollowAudioRunner` then calls `drawn` on it, which closes the earlier bitmaps. The loop only redraws while playing, so every preview stays blank until play resumes, though the taps are still there and `frame()` would redraw them. It should publish the errors over the current previews, as `previews.draw(errors)` does, or redraw once.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/liveRunner.ts
- size: line
- cause: error publish replaces the preview run instead of merging into it
- confidence: likely

## Cluster reorder reads undrawn order items as drawn, where the stage reorder filters them out
- where: packages/diagram/src/effect/editorReorder.ts:131 (clusterReorder, moved)
- scenario: the look's `order` lists a main-chain stage that has no drawn box (`boxOf` undefined). The stage reorder (`createEditorReorderContributions`) passes `drawnOrder(order, boxOf)`, so `dropInGap` counts that stage as undrawn and also tries the chain gaps beside it. `clusterReorder` passes the raw `order` to `clusterMove`, so `drawnOf(order)` counts the same stage as drawn: `dropInGap` never tries the gaps beside it, and `indices(before, true)` can take that stage's index as the edge of the gap. So one question, which stages are drawn, gets two answers. A cluster drop that a stage drop into the same gap would land is refused, or lands on the far side of the boxless stage.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/editorReorder.ts
- size: line
- cause: raw order passed where drawnOrder is used elsewhere
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
