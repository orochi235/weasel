## canConnect matches the moving wire's minted id against the raw doc, so an id-less or repeated-id wire still feeds its own input while its end is dragged
- where: packages/diagram/src/effect/editorHandlers.ts:88 (editHandlers → canConnect)
- scenario: a doc whose wire into a single (non-`many`) input has no id, or repeats an earlier wire's id. The user drags that wire's `from` end to another output of the right type. `built.wireOf(moving.edge)` returns the id `ensureWireIds(doc)` gives it (e.g. `w3`), but `wireFor(doc.pipeline, …, except)` runs `fed` over the raw `doc.pipeline.wires`, where no wire has `w3`. So the wire being moved is not filtered out, `inputFed` sees the input as fed, and `canConnect` answers false: the reconnect is refused. With a repeated id, the first of the pair gets `except` equal to the shared id and the filter drops both wires, so a second wire that really does feed the input is ignored. `onReconnect` itself calls `commit`, which runs `ensureWireIds` first, so the two paths answer the same question two ways. canConnect should read `ensureWireIds(doc).pipeline`, as `commit` does.
- evidence: read
- severity: medium
- size: line
- cause: raw doc vs ensureWireIds ids
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
