## canConnect counts an id-less or repeated-id wire as feeding its own input while its end is dragged
- where: packages/diagram/src/effect/editorHandlers.ts:96 (editHandlers → canConnect)
- scenario: doc has an id-less wire `src.out → gain.in` (or a second wire repeating an earlier wire's id), `gain.in` takes one wire. The user drags that wire's `from` end to another output. `except` is `built.wireOf(moving.edge)`, the id the wire gets in `ensureWireIds(doc)` (e.g. `w1`), but `fed` filters `now().doc.pipeline.wires` — the raw doc, where the wire's id is `undefined` (or the earlier wire's id). The filter keeps the moving wire, `inputFed` sees `gain.in` already fed, and `canConnect` refuses every target, so the reconnect can never be made. `onReconnect` itself runs on `ensureWireIds(d)` and would accept it; the two disagree on which wire is being moved. Should test against `ensureWireIds(doc).pipeline`.
- evidence: read
- severity: medium
- size: line
- cause: raw doc ids compared with ensured ids
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
