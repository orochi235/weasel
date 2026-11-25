# Audit round 78 — diagram.effect.part1

## Node defs built for a structural batch the graph refuses are dropped without `dispose`
- where: packages/diagram/src/effect/audio/liveRunner.ts:211 (createLiveAudioRunner → sync)
- scenario: `sync` builds a `GraphNodeDef` for every added or replaced node in `buildablePlan`, each holding live AudioNodes made on `engine.context`. When `graph.check(structural)` throws, `applyStructure` returns `{ landed: false }` and `plan` stays `from`, so every def in `defs` is unreachable. Nothing calls `def.dispose?.()` on them, and the graph never owned them. Every later `setPipeline`/`setSources` that is still refused builds and leaks a fresh set. The defs should be disposed when the batch does not land, and so should any def built for a node `prune` then dropped.
- evidence: read (GraphNodeDef.dispose in packages/audio/src/graph/types.ts: "Called once, after the node has faded out of the graph"; only the graph calls it, so only defs it took get disposed)
- severity: low

## A wire picked before a controlled `selected` change shows picked again once `selected` returns to null
- where: packages/diagram/src/effect/editorPicks.ts:43 (useEditorPicks)
- scenario: The user clicks a wire, so `edge` = that wire's edge id. The parent then sets `selected="s1"` from outside (a list, a search), so `shown` = `s1`. Later the parent sets `selected={null}`, and `shown` falls through `live(null) ?? live(cluster) ?? wire` back to the old `edge`. DiagramView then draws the wire as selected, although nothing picked it since. The internal `edge` is cleared only by a pick or by `unpick` on delete, never when the controlled selection moves away from it.
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
