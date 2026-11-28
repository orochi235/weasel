# Findings: diagram.effect.part1

## moveRunInChain picks a moved run's unwired main port without regard to type or control, refusing valid moves
- where: packages/diagram/src/effect/chainEdit.ts:85 (moveRunInChain)
- scenario: the stage being moved is the head of the main chain (`i === 0`, so `mainIn` has no entry for it), and its first open input is a control-typed port, for example inputs `[{ id: 'amount', type: 'number' }, { id: 'in', type: 'image' }]` with `number` marked `control`. Dragging it into the middle of the chain gives `sIn = pick(first, 'inputs')`, which is `'amount'`. The wire into it, a→first, reuses `wAB`'s data output (`aOut = p.wires[wAB].from.port`, an image port). `canWire` then sees `image` ≠ `number` and the move returns `null`, so the drop is refused even though `'in'` would take the wire. The same happens on the `sOut = pick(last, 'outputs')` side for a run whose last stage is the chain's tail and whose first output is control-typed. The code should pick a non-control port, or one matching the type of the neighbor it is being wired to (the `type` argument `pick` already accepts).
- evidence: read
- severity: low
- size: function
- cause: port pick ignores the neighbor's type and control wires
- confidence: likely

## clusterContents and clusterParents disagree with how clusters are drawn when a member is named twice or clusters loop
- where: packages/diagram/src/effect/clusterEdit.ts:150 (clusterContents), clusterEdit.ts:44 (clusterParents)
- scenario: stage `s` is listed in cluster A and again in cluster B (A first). `nestClusters` (packages/diagram/src/clusterTree.ts:48) draws `s` only in A. `clusterContents(doc, 'B')` still counts `s`, so dragging B's box under nodeGraph (`dragEdit` → `moveCluster`) also moves `s`, which is drawn inside A. `clusterRuns`/`clusterGripOf` read the same over-broad membership. For a loop (A holds B, B holds A), `nestClusters` drops B's claim on A, so A is drawn at the top level. `clusterParents` still records B as A's parent, so `clusterDepth` and `clusterSlotsAt`'s sibling set are computed against a tree the drawing does not have. Both inputs are ones `checkPipeline` reports but a doc can still hold, and the editor draws them. The rule for who holds what is decided once in `nestClusters`, and again, differently, here.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/clusterEdit.ts, packages/diagram/src/effect/clusterOrder.ts
- size: function
- cause: second definition of cluster membership diverges from nestClusters
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
