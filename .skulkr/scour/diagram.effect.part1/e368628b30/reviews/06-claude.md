## canConnect refuses to move the source end of a wire that has no id (or repeats an earlier wire's id)
- where: packages/diagram/src/effect/editorHandlers.ts:96 (editHandlers → canConnect), via `fed` at :32
- scenario: a doc (as handed in by a caller, or read with `readEffectDoc`) has a wire with no `id`, A.out → B.in, where B.in is not `many`. The user drags that wire's `from` end onto C.out. `canConnect` gets `except = built.wireOf(edge)`, which is the id the wire *will* get in `ensureWireIds(doc)` (e.g. `w1`), but it then checks `fed` against the raw `doc.pipeline.wires`, where that wire's `id` is `undefined`. `w.id !== except` keeps the wire itself, so B.in counts as fed by the very wire being moved and the reconnect is refused. The same happens for a wire whose id repeats an earlier one: `wireOf` gives the freshly minted id, which no raw wire carries. `onReconnect` (:111) would allow the move because it runs on `ensureWireIds(doc)`; only the gesture gate disagrees, so the two places answer the same question differently.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/editorHandlers.ts
- size: line
- cause: gate reads raw wires, ids come from ensureWireIds
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
