## A wire id equal to a stage id (or a minted id colliding across namespaces) makes `diagramScene` throw, and `checkPipeline` never reports it
- where: packages/diagram/src/effect/edit.ts:20 (nextWireId), packages/diagram/src/effect/edit.ts:15 (nextStageId), packages/diagram/src/effect/check.ts:98 (checkPipeline wire loop)
- scenario: a doc with a stage whose id is `w1` (any user-chosen id) and no wires; the user connects two ports in `EffectEditor`. `addWire` → `nextWireId` checks only wire ids and mints `w1`. `wireEdges`/`drawableWires` keep the wire's id as the edge id, so the edge spec and the stage's node spec are both `w1`, and `diagramScene` throws "two things would share the scene id \"w1\"" (fromData.ts:249): the editor and `EffectChart` crash on the next render. The same happens for a loaded pipeline whose wire id equals a stage or cluster id, and `ensureWireIds` mints the same way. Likewise `nextStageId` avoids only stage ids: adding a stage whose type id equals an existing cluster id (a hand-written cluster `source`, then Add stage "source") makes `uniqueClusters` silently drop that cluster and its box. Expected: minted ids avoid every id sharing the scene's id space (stages, clusters, wires), and `checkPipeline` reports a wire id that names a stage or cluster, as it does a cluster id naming a stage.
- evidence: read
- severity: medium
- fix: packages/diagram/src/effect/edit.ts, packages/diagram/src/effect/check.ts, packages/diagram/src/effect/draw.ts
- size: function
- cause: id minting checks only its own namespace
- confidence: likely

## Reordering lanes drops every `laneOrder` entry whose type has no stage yet
- where: packages/diagram/src/effect/editorReorder.ts:117 (laneMove)
- scenario: doc.laneOrder is `['mask', 'image', 'number']` and the pipeline currently has no mask stage. `lanes` draws only used types (`laneTypes` keeps the `first` the pipeline uses), so the drawn lane order is image, number. Dragging number above image calls `setLaneOrder(doc, ['number', 'image'])`, erasing `mask`; adding a mask stage later puts its lane last instead of first. Expected: the move reorders the drawn lanes and keeps the undrawn entries of `doc.laneOrder` (and the options' `lanes`) where they were.
- evidence: read
- severity: low
- size: function
- cause: lane order rebuilt from drawn lanes only
- confidence: sure

## An edit that changes the errors while paused wipes the previews already drawn, and they stay blank until play
- where: packages/diagram/src/effect/audio/liveRunner.ts:226 (publishErrors), packages/diagram/src/effect/audio/liveRunner.ts:271 (frame)
- scenario: previews on 'scope', play, pause: the last frame's scopes stay on the stages. Now edit a stage so it errors (or clear an error): `publishErrors` publishes `errorsRun(next)`, a run with no previews, so every scope on the chart disappears; `frame` only runs while playing, so nothing redraws them until the user plays again. Expected: an error change keeps the previews of the run it replaces (or redraws from the taps), so the frozen scopes stay up.
- evidence: read
- severity: low
- size: function
- cause: errors-only run replaces preview run
- confidence: likely

## `checkPipeline` does not report a cluster that names the same member twice
- where: packages/diagram/src/effect/check.ts:138 (checkPipeline, duplicate-member)
- scenario: `clusters: [{ id: 'g', members: ['a', 'a'] }]`: the second `a` finds `holder.get('a') === 'g'` and the `first !== cluster.id` test skips it, so no problem is reported, though `duplicate-member` exists for a member held twice and the repeat reaches the looks and `dissolveCluster` (which then splices `a` into the parent twice). Expected: a `duplicate-member` problem for the repeat.
- evidence: read
- severity: low
- size: line
- cause: same-cluster repeat exempted
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

<!-- done: 4 findings, files read: 31 -->
