# Findings: diagram.effect.part1

## clusterStages deletes a boxed cluster it empties, where moveToCluster keeps it
- where: packages/diagram/src/effect/clusterEdit.ts:93 (clusterStages)
- scenario: under `nodeGraph`, cluster `P` has a `clusterBoxes` entry and holds only stage `A`; stage `B` is top level. `EffectEditorApi.cluster(['A', 'B'])` → the members have different parents, so `pruneClusters(clusters, taken)` runs with no `keep`, `P` is emptied and dropped, and `withClusters` drops its box too. Dragging `A` out of `P` instead goes through `moveToCluster`, whose `boxed` keep leaves `P` and its box in place. The same question, whether a boxed cluster survives being emptied, gets two answers. Taking members out for a new group should keep a boxed `P`, as a drag does.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/clusterEdit.ts
- size: line
- cause: pruneClusters called without the boxed keep
- confidence: sure

## Renaming a cluster whose label has outer spaces reports 'Rename group' when nothing changed
- where: packages/diagram/src/effect/clusterTitle.tsx:44 (useClusterTitle `done`)
- scenario: a doc loaded with cluster label `" Mix "` (docShape accepts any string). The user opens the rename field and presses Enter, or clicks away, without typing. `ClusterTitleField` hands back `text.trim()` = `"Mix"`, and `"Mix" !== " Mix "`, so `onChange` gets a doc and an undo entry for an edit the user never made. It should compare against the trimmed label, or not trim.
- evidence: read
- severity: low
- size: line
- cause: trimmed text compared to untrimmed label
- confidence: sure

## Clearing a route that isn't there still sends an 'Edit route' edit under nodeGraph
- where: packages/diagram/src/effect/editorHandlers.ts:111 (editHandlers onEditRoute)
- scenario: under `nodeGraph`, a wire with no entry in `doc.routes` reports a `RouteChange` with empty `waypoints`. `setWireRoute(d, id, [])` returns a new doc with `routes: {}`, and `commit` hands it to `onChange` as 'Edit route': an undo entry that changes nothing, and an empty `routes` written into the doc. The rack/lanes branch just above returns `null` for the same case (`was === undefined`), so each look answers it differently.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/edit.ts
- size: line
- cause: no no-op check on the nodeGraph path
- confidence: sure

## The cluster reorder counts order items with no drawn box as drawn; the stage reorder drops them
- where: packages/diagram/src/effect/editorReorder.ts:136 (clusterReorder `moved`)
- scenario: the stage reorder passes `drawnOrder(order, boxOf)` to `stageMove`, so only items with a drawn box count as "drawn" (the comment at `drawnOrder` says a move's indices count only these). `clusterReorder` passes the raw `order` to `clusterMove`, and `drawnOf(order)` there treats an item with no box as drawn. `dropInGap` then stops trying gaps at that stage, and `indices(before, true)` counts it. A look item without a box (one not yet laid out, or one the look leaves undrawn) can therefore make a cluster drop that the stage path would accept come back `null`, or land in a different gap. The two reorders read "drawn" differently.
- evidence: read
- severity: low
- size: line
- cause: drawnOrder filter not applied on the cluster path
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
