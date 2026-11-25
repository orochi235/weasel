# Audit round 72 — diagram.effect.part1 (reviewer findings)

## Editor connect/reconnect refuses rack's tap ports: port ids are not untapped as the edge mapping does
- where: packages/diagram/src/effect/editorHandlers.ts:87 (canConnect), :100 (onReconnect)
- scenario: under the `rack` look a main output that also feeds a stage further along gets a side port `~tap:<out>` (rack.ts:143/169), drawn as a real typed port while `ports="connect"`. Dragging a new wire from that port, or dragging a wire's `from` end onto another stage's tap, hands `canConnect`/`onReconnect` the port id `~tap:out`; `canWire` looks for an output with that id, finds none, and the connect/reconnect is refused. `editorMapping.edgeEnds` already maps the same ids back through `untapped`, so the two paths answer "which port is this" differently. Should untap `from.id`/`c.port` (on the output side) before `wireFor`/`canWire`.
- evidence: read
- severity: medium

## Moving a cluster moves its inside wires' routes but leaves their `{ near }` label placements behind
- where: packages/diagram/src/effect/clusterEdit.ts:158 (moveCluster)
- scenario: under `nodeGraph`, a wire with both ends inside cluster G has a route and a label the user dragged (`labels[w] = { at: { near: {x,y} } }`, a world point per labelTrait.ts:11). Dragging G by (dx,dy) offsets the places, the boxes and the route, but `doc.labels` is copied unchanged, so the label is placed at the route point nearest the old world location — it slides along the wire (or to its end) instead of moving with the cluster as everything else inside does.
- evidence: read
- severity: low

## A wire minted into a freed id by a chain move inherits the removed wire's label placement
- where: packages/diagram/src/effect/chainEdit.ts:105-114 (moveRunInChain)
- scenario: move the last chain stage S (prev P → S by wire `w1`) to an earlier gap a|b. `wIn` (`w1`) is in `gone` and not reused (no `next`), so it is dropped; the new S→b wire has `reuse: undefined` and gets `nextWireId` over the remaining wires, which is `w1` again. `pruneRoutes(..., gone ids)` drops `w1`'s route and look routes (the line 113 comment's intent), but `pruneLabels` keeps every label whose id still exists, so `labels.w1` (placement, offset, `near` point) now positions the label of an unrelated wire.
- evidence: read
- severity: low

## The live audio graph keeps a level the plan stopped giving, where a fresh build uses the node's default
- where: packages/diagram/src/effect/audio/patches.ts:48-51 (diffPlans) with plan.ts:36 (levelsOf)
- scenario: `levelsOf` drops a numeric param that is absent or not a number (`paramValues` returns the display string for a param with no control, or a `kind:'string'` control after `setParam`). A playing gain stage at 0.2 whose `gain` param loses its number control gets `levels: {}`; `diffPlans` only emits `set` for keys in `now.levels`, so the graph stays at 0.2, while `reset()` (or any rebuild) builds the node with its factory default 1. Same pipeline, two sounds depending on history. Unlike settings, levels never fall back to `defaultOf`.
- evidence: read
- severity: low

## Reorder moves index the unfiltered `order.items` while the slots were built from the boxed subset
- where: packages/diagram/src/effect/editorReorder.ts:32-38 (slotsOf), :72 (stageMove), :104 (laneMove)
- scenario: `slotsOf` drops an order item whose `boxOf` is undefined, so `move.from`/`move.to` index that filtered list; `stageMove` reads `order.items[move.to]` and `laneMove` reorders `order.items`' lane types by `move.from`/`move.to`. With any item missing a box (an item the look orders but the specs don't draw under that id), every index after it is off by one: the stage drops one gap early, and `laneMove` moves the wrong lane. `clusterMove` avoids this by reading `move.order`.
- evidence: read (no case found where a look's order item lacks a drawn spec; plausible only)
- severity: low

## A chain reorder refuses to wire into a `many` input that already has a side wire
- where: packages/diagram/src/effect/chainEdit.ts:74 (moveRunInChain, `free`), :76, :97
- scenario: every audio input is `many: true` (audio/stageTypes.ts:14). Pipeline osc→filter→gain→out with noise→gain.in as a second wire into the same input. Under `rack`, drag `gain` to the gap between osc and filter: the new osc→gain.in wire is checked with `free`, which is false whenever any kept wire ends at gain.in (the noise wire), so `moveRunInChain` returns null and the drop is refused. The editor's own connect path (`editorHandlers.fed`) lets a `many` input take another wire from a different output, so the two paths answer "may this input take this wire" differently; `pick` also skips a many input that has a side wire.
- evidence: read
- severity: medium

## The live audio plan plays wires the looks do not draw: a wire from a missing or input port, or into a missing port of the output
- where: packages/diagram/src/effect/audio/plan.ts:66-68, :86-89 (livePlan)
- scenario: `fed` takes every wire into the stage whose `from.stage` is planned, without checking that `from.port` is one of that stage's outputs. A wire `{ from: { stage: 'osc', port: 'bogus' }, to: { stage: 'gain', port: 'in' } }` (or one starting at an input, a `wrong-direction` problem) is dropped by `drawableWires`, so the chart shows no wire, but the graph connects osc's output to gain and plays it. Into `audio.output`, `to.port` is not checked either, so a wire to `out.nope` reaches the speakers while undrawn. (A missing `to.port` on other nodes is caught by `buildablePlan` with an error; the from side and the output never are.)
- evidence: read
- severity: low

## A cluster id with the reserved `~` prefix is neither reported nor refused, and collides with look-made ids
- where: packages/diagram/src/effect/check.ts:36-51 (firstReserved / assertNoReservedIds), :107-120 (checkPipeline clusters)
- scenario: the reserved-prefix rule covers stage and port ids only. A cluster with id `~lane:audio` under `lanes` shares its id with the lane node `laneId('audio')` (lanes.ts:50), so `diagramScene` sees one id naming two things and throws (draw.ts:110 says it throws on that), and in the editor `editorMapping.clusterOf` would also claim the lane header as a cluster. `checkPipeline` returns no problem for it, and `assertNoReservedIds` lets it through, so the caller gets a throw with no `reserved-id` problem explaining it.
- evidence: read (lanes cluster drawing path not traced to the throw)
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

<!-- done: 8 findings, files read: 31 -->
