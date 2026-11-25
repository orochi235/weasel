## Reordering, adding or removing a scene layer leaves the visibility index's tag bits stale, so a layer's nodes are pruned
- where: packages/core/src/canvas/reach/sceneVisibility.ts:117 (SceneVisibility.tagOf), with sceneReachSource.tagsOf at :160
- scenario: a scene of 512+ nodes with layers [A, B]. Records are built with A's nodes tagged bit 0, B's bit 1. The layers are reordered to [B, A] (a layer op, which `sceneTouches.noteOp` records only as the layer's id, a non-node, so `ensure` neither rebuilds nor re-reads any node's tags). `tagOf` rebuilds its map from the new `scene.layers` array, so a query drawing only A (B hidden by `layerVisibility`) asks for bit 1; A's records still carry bit 0, `boxMeets` sees `tags & wanted === 0`, and every subtree of A is pruned: A paints nothing. With both drawn, A's nodes are tested against B's view region, wrong under parallax. Inserting a layer below others shifts every later layer's bit the same way. Tags should be stable per layer id, or a layer stack change should invalidate the trees.
- evidence: read (sceneTouches.ts:99-102 notes a layer op as content on the layer id; reachTree.apply skips ids with no `parentOf`)
- severity: high

## A node moved to another layer reports its damage only to its new layer's tiles
- where: packages/core/src/canvas/reach/tileDamage.ts:41 (damage callback) with reachTree.ts:76-80 (ensure)
- scenario: a `setLayer` op moves node N from tiled layer A to tiled layer B. `ensure` reports N's own box before applying and after, but the callback reads `scene.get(id)?.layer` at report time, which is B for both reports (the scene already changed). A's queue gets nothing, so A's tiles keep showing N where it was. The before-report should be attributed to the layer the record was built under.
- evidence: read
- severity: medium

## Tile damage reports only a node's own box, never the copies a container paints of it
- where: packages/core/src/canvas/reach/reachTree.ts:87 (touched / report with `reach: false`)
- scenario: a container with `copiesFromPose` (a repeat) over child C, on a tiled layer. C moves: the feed names C, `report` sends C's own box before and after, but the container paints C again under each copy affine elsewhere; those regions are not marked stale and their tiles keep the old copies. The container's own record is reported (if touched) by its own box too, not its reach, which is where `imagesOf` lands.
- evidence: read
- severity: medium

## WideChildren.meeting dedups by an epoch per container stored on the record, so a reparented child can be skipped
- where: packages/core/src/canvas/reach/wideChildren.ts:68 (meeting / take)
- scenario: child R under wide container P1 is last seen at P1's epoch 7 (`R.seen = 7`). R is moved under wide container P2, whose own `epoch` counter is at 6. P2's next query sets epoch 7; `take(R)` finds `R.seen === 7` and returns without testing or pushing R, so `childrenMeeting` omits R and its whole subtree is pruned for that frame although it is in view. The epoch needs to be global (or the record's `seen` keyed by container).
- evidence: read
- severity: low

## A tile source's damage queue grows without bound for a layer that stops reading it
- where: packages/core/src/canvas/reach/tileDamage.ts:44-47 (createSceneTileSources)
- scenario: every damage report is pushed into every registered layer's queue; a queue is emptied only by its own `since()`. A layer that stops being tiled or is removed, while another layer's `since`/`bounds` keeps calling `ensure`, accumulates a `Float64Array` per changed node per change forever. Nothing removes its entry from `queues`.
- evidence: read
- severity: low

## wireSceneSlotToScene builds a fresh scene-wide reach tree for tiles on every call
- where: packages/core/src/canvas/sceneSlotWiring.ts:85 (wireSceneSlotToScene)
- scenario: with `slot.tiles` set, each wiring calls `createSceneTileSources`, which makes a new reach tree (built from the whole scene on first ensure) and empty damage queues. If the slot is rewired (a new `alphaFor`, overrides, or slot object), the new tile sources start with no history, so damage between the old tree's last read and the new tree's first build is lost (the first build of a tree reports no `'all'`, reachTree.ts:69). Plausible, depending on how often the caller rewires.
- evidence: read (call-site memoization not checked)
- severity: low

## Files read
packages/core/src/canvas/pressTarget.ts
packages/core/src/canvas/publishPreviews.ts
packages/core/src/canvas/rasterReadback.ts
packages/core/src/canvas/rasterToPng.ts
packages/core/src/canvas/reach/boxes2d.ts
packages/core/src/canvas/reach/reachBoxes.ts
packages/core/src/canvas/reach/reachRec.ts
packages/core/src/canvas/reach/reachRegion.ts
packages/core/src/canvas/reach/reachTree.ts
packages/core/src/canvas/reach/reachTypes.ts
packages/core/src/canvas/reach/sceneVisibility.ts
packages/core/src/canvas/reach/tileDamage.ts
packages/core/src/canvas/reach/wideChildren.ts
packages/core/src/canvas/readCanvasPixels.ts
packages/core/src/canvas/readback.ts
packages/core/src/canvas/registerShaders.ts
packages/core/src/canvas/renderDebugSnapshot.ts
packages/core/src/canvas/renderDiagnostics.ts
packages/core/src/canvas/renderNeeds.ts
packages/core/src/canvas/renderSceneToPixels.ts
packages/core/src/canvas/renderSceneToPixelsTypes.ts
packages/core/src/canvas/sceneAdapter.ts
packages/core/src/canvas/sceneClipboard.ts
packages/core/src/canvas/sceneLayerPaint.ts
packages/core/src/canvas/scenePickIds.ts
packages/core/src/canvas/scenePickReads.ts
packages/core/src/canvas/scenePickSource.ts
packages/core/src/canvas/sceneShapes.ts
packages/core/src/canvas/sceneSlotWiring.ts
packages/core/src/canvas/sceneViewRender.ts
packages/core/src/canvas/selectRange.ts
packages/core/src/canvas/selectionChrome.ts
packages/core/src/canvas/shownNodes.ts
packages/core/src/canvas/slopsDebugLayer.ts
packages/core/src/canvas/surfaceContribution.ts
packages/core/src/canvas/testing/stubCanvasContext.ts
packages/core/src/canvas/tileHosts.ts
packages/core/src/canvas/timelineFrames.ts
packages/core/src/canvas/topmostOf.ts

<!-- done: 6 findings, files read: 39 -->
