# core.canvas.part3 findings

## A visibility tree keeps each node's layer tag bit from when it was boxed, so reordering or inserting a scene layer culls nodes that are on screen
- where: packages/core/src/canvas/reach/sceneVisibility.ts:117 (SceneVisibility.tagOf), packages/core/src/canvas/reach/reachBoxes.ts:96 (readOwn)
- scenario: a scene with ≥ 512 nodes and layers [a, b, c]. Nodes on `c` are boxed with tag `1 << 2`. The layers get reordered, or a layer is inserted before `c`. `tagOf` sees a new `scene.layers` array and remaps `c` to a different index, but a layer's own record only notes the layer id in the touch journal (sceneTouches.ts:100–101, which is not a node id, so `Tree.apply` drops it as absent). No node record is re-read, so `rec.tags` / `reachTags` still carry the old bit. `sceneSubtreeCull` then asks with `wanted` = the new bit for `c`, `boxMeets` finds `tags & q.wanted === 0`, and every subtree on `c` is pruned. The layer goes blank until some unrelated change rebuilds the tree. It should either rebuild, or re-tag every record, when the layer→bit map changes.
- evidence: read (sceneTouches.ts noteTouch default branch; reachBoxes readOwn runs only when `ownStale` is set)
- severity: high

## Tile damage for a node moved to another layer is reported only to its new layer, so the old layer's tiles keep showing it
- where: packages/core/src/canvas/reach/tileDamage.ts:40 (damage callback in createSceneTileSources)
- scenario: a node on tiled layer A gets a `setLayer` to B. `Tree.ensure` reports the node's box before the change applies and again after, but the callback finds the layer with `scene.get(id)?.layer` at report time. Both times the scene already says B, so both boxes go to B's queue and none to A's. A's tiles under the node stay as they were, and its old paint still shows on layer A. The "before" box should go to the layer the node was on.
- evidence: read
- severity: medium

## Tile damage misses where a container paints copies of a changed child
- where: packages/core/src/canvas/reach/reachTree.ts:83 (Tree.touched / report)
- scenario: a group whose `copiesFromPose` repeats its children (an array or mirror) sits in a tiled layer. A child moves. `touched` reports only the child's own box (`reach: false` for every id), before and after. The copies the container paints elsewhere move too, but the container is not in `ids` (the feed widens to descendants and dependents, not ancestors), and the copies' images never reach `damage`. Tiles under the copies stay stale. The copied images of a moved box should be reported too: walk up to each ancestor with images and report the mapped box, or report its reach.
- evidence: read (the `reach` flag on touched entries is always false; reachBoxes applies images only to `rec.reach`)
- severity: medium

## The `rec.joined` and queue-depth handling can recompute a record twice, at its stale depth before its new children
- where: packages/core/src/canvas/reach/reachTree.ts:170 (Tree.apply, `if (rec.queued) rec.queued = false`)
- scenario: a record already queued at depth 3 (its parent listed in `parents`, say) is moved under a root, so its depth becomes 1. `apply` clears `queued` and enqueues it again at depth 1, but the old entry stays in `queue[3]`. `drain` processes it at depth 3 first. That is before deeper records that are now its children (moved in under it in the same change) have drained, so it recomputes from their stale reaches, then puts itself into its new parent's index and enqueues that parent. Depth 1 recomputes it again, so the final box is right, but the parent's wide index takes an intermediate `put`. This is only wasted work and a transient box; noted as low.
- evidence: read
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

<!-- done: 4 findings, files read: 39 -->
