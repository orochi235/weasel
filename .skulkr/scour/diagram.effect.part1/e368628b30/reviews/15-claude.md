# Findings: diagram.effect.part1

## canConnect refuses to reconnect a wire that has no id of its own (or repeats another's), because it excludes the moving wire by its minted id from the raw doc
- where: packages/diagram/src/effect/editorHandlers.ts:94 (editHandlers → canConnect)
- scenario: A doc whose wire `src.out → blur.in` has no `id` (wire ids are optional in `EffectPipeline`). In `EffectEditor`, drag that wire's `from` end onto another stage's output of the same type. `built.wireOf(moving.edge)` gives the id the wire *will* get in `ensureWireIds(doc)` (e.g. `w1`). But `canConnect` passes the raw `doc.pipeline` to `wireFor` → `fed`, which filters `p.wires` by `w.id !== except`. The id-less wire is not filtered out, so `blur.in` counts as already fed by the wire being moved, and `canConnect` returns false. The drop is refused, even though `onReconnect` (which works on `ensureWireIds(doc)`) would accept it. The same happens for the second of two wires sharing an id: its minted id names no raw wire. And when the moving wire is the first of the pair, both are excluded, so the other one's input wrongly counts as free. Expected: run `ensureWireIds(doc)` before checking, as `commit` does for every other handler.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/editorHandlers.ts
- size: line
- cause: canConnect reads the raw doc while wireOf answers in ensureWireIds ids
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

<!-- done: 1 findings, files read: 31 -->
