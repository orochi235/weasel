# Audit round 72, area diagram.effect.part1

## A missing numeric param plays at the factory's default, not the stage type's, while discrete settings use the stage type's
- where: packages/diagram/src/effect/audio/plan.ts:36 (levelsOf), packages/diagram/src/effect/audio/nodes.ts:36 (node.settings)
- scenario: a pipeline stage `{ id: 'd', type: 'audio.delay', inputs, outputs }` with no `params` (or a params list missing `time`/`feedback`/`mix`). `settings` falls back to `AUDIO_STAGE_TYPES`' defaults (`defaultOf`), but `levelsOf` only reads `getOwn(params, id)`, so the level is omitted and `createDelayEffect` applies its own defaults: 250 ms / 0.35 / 0.35 instead of the stage type's 300 ms / 0.4 / 0.5 that the editor shows. Same question ("what does a missing param default to") answered two ways. Relatedly, a level that disappears from `now.levels` between syncs gets no `set` patch in `diffPlans` (patches.ts:48), so the graph keeps the old value instead of returning to the default.
- evidence: read (effects.ts:151–159 defaults vs stageTypes.ts:45–50)
- severity: medium

## applyStructure reports "nothing changed" after a runtime throw in a batch with no adds, though every patch landed
- where: packages/diagram/src/effect/audio/liveRunner.ts:133 (applyStructure)
- scenario: `AudioGraph.apply` validates the whole batch first and then applies every patch, collecting the first runtime error and throwing it after the rest landed (packages/audio/src/graph/createAudioGraph.ts:76–93). `applyStructure` treats a throw as "changed nothing" unless the batch had `add`s that are now present. A batch of only `replace`/`remove`/`connect` whose execution throws (e.g. `setSources` with a new buffer while playing: `replace` of the `audio.file` node restarts a source, which can throw) returns `false`: `plan` stays at `from`, `ports` is not updated and the queued `set` patches are skipped, though the graph now holds the new nodes. The next sync diffs from a plan the graph no longer matches; a landed `remove` then makes every later diff emit `remove` for a node that is gone, which fails validation, so the runner stops following the pipeline at all.
- evidence: read
- severity: medium

## ClusterTitleField can report its rename twice: Enter, then the blur from its own removal
- where: packages/diagram/src/effect/clusterTitle.tsx:55 (ClusterTitleField.finish)
- scenario: the guard is `done` state, read from the render's closure. Enter calls `finish`, which sets `done` and calls `onDone` → `setRenaming(null)`; the field is unmounted in the next commit and never re-renders with `done === true`. Removing the focused input fires `blur` in Chromium during the commit's removal, while React still has the handler attached, so `onBlur` runs the stale `finish` with `done === false` and calls `onDone` again: a second `onChange(renameCluster(...), 'Rename group')`, a duplicate undo entry. A ref (not state) guard closes it.
- evidence: inference from React's commit order and Chromium's blur-on-removal; not run
- severity: low

## Reconnecting a wire under nodeGraph keeps its hand-set route, which a reorder's rewiring drops
- where: packages/diagram/src/effect/editorHandlers.ts:96 (onReconnect)
- scenario: under `nodeGraph`, wire `w1` from `a.out` to `b.in` has `routes.w1` waypoints bent around `b`. Dragging its `to` end onto `c.in` far away calls `reconnectWire` only; `routes.w1` stays, so the reconnected wire is drawn through waypoints placed for the old ends. `pruneRoutes(doc, rewired)` exists for exactly this ("less those of the `rewired` wires, whose ends now join other ports") and `moveRunInChain` uses it (chainEdit.ts:114, commit 48a8a32c17: "A reorder prunes the routes of every wire it rewires"). The two rewiring paths answer "does a rewired wire keep its route" differently. (`lookRoutes` self-invalidate on their stored `ends`; `routes` have no such check.)
- evidence: read
- severity: low

## Moving a cluster translates the routes of wires inside it but not their labels' `near` points
- where: packages/diagram/src/effect/clusterEdit.ts:158 (moveCluster)
- scenario: a wire `w` with both ends inside cluster `g` has `routes.w` and a label placed by drag at `labels.w = { at: { near: P } }`. Dragging `g`'s box by (400, 0) moves the stage places, `routes.w` and the boxes by the offset, but `labels.w.at.near` stays at `P`; the label resolves to the point of the moved route nearest the old spot, so it lands at the route's left end (or another stretch) instead of riding along with the rigidly moved wire.
- evidence: read
- severity: low

## A wire repeating an earlier wire's id is edited through that id: deleting or reconnecting it changes both wires
- where: packages/diagram/src/effect/editorMapping.ts:55 (editorScene wireOf)
- scenario: a loaded doc has two wires both `id: 'w1'` (checkPipeline reports `duplicate-wire`; `drawableWires` draws the second without its id). `wireOf` maps the second's edge to `ids[index]` from `ensureWireIds(doc)`, which keeps the repeated `'w1'`. Selecting the second wire and pressing Delete calls `removeWires(d, ['w1'])`, which removes both wires; a reconnect of the second rewires both (`reconnectWire` maps every `w.id === id`). The edit should touch only the wire picked.
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

<!-- done: 6 findings, files read: 31 -->
