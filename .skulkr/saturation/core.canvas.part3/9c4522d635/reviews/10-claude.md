# Findings: core.canvas.part3

## Reordering or inserting a scene layer leaves the visibility index's tag bits stale, so nodes on shifted layers are pruned from the render walk
- where: packages/core/src/canvas/reach/sceneVisibility.ts:96 (SceneVisibility.tagOf), :167 (tagsOf), :231 (sceneSubtreeCull)
- scenario: a scene with at least 512 nodes and layers [a, b]. Nodes on `b` are tagged with bit 1 when their records are read (`readOwn` → `tagsOf`). Then a layer is added below `a`, or `a` and `b` swap. `tagOf` sees a new `layers` array and remaps `b` to bit 2 (or 0). The tree is not rebuilt, because the touches feed notes a layer's own op only as the layer id (`sceneTouches.ts:99-101`, the default branch). That id is no node, so `apply` changes nothing. The query now asks for `b`'s new bit, but records still carry the old one. `boxMeets` fails for every node on `b`, `childrenMeeting` prunes them, and the layer draws empty until something touches those nodes. It should rebuild, or retag, when the layer-to-bit mapping changes.
- evidence: read (sceneVisibility.ts tagOf/tagsOf, reachBoxes.readOwn, sceneTouches.noteOp default branch)
- severity: high

## A node moved to another layer never damages its old layer's tiles
- where: packages/core/src/canvas/reach/tileDamage.ts:42 (createSceneTileSources damage callback), packages/core/src/canvas/reach/reachTree.ts:80 (Tree.ensure)
- scenario: two tiled scene layers A and B, and node n on A. `setLayer(n, B)` runs. On the next `since()`, `ensure` reports n's old own box ("before") and then its new one. Both go through the callback, which reads `scene.get(id)?.layer`, and the scene already says B by then. So the old box is pushed only to B's queue. A's tiles keep n's pixels baked in where it used to be. The before-box should go to the layer the node was on when its box was taken (for example, record the layer on the rec), or to every queue.
- evidence: read
- severity: high

## A child moved between two wide containers can be skipped by the destination's BVH query because `seen` epochs are per container
- where: packages/core/src/canvas/reach/wideChildren.ts:69 (WideChildren.meeting, `take`), packages/core/src/canvas/reach/reachRec.ts:23 (`seen`)
- scenario: each `WideChildren` counts its own `epoch` from 0, but `rec.seen` lives on the record. Child c of wide container A was last met at A's epoch 7, so `c.seen = 7`. c is then moved into wide container B (the rec object is reused by `apply`). B has been queried less often, and its next query is B's epoch 7. `take(c)` sees `rec.seen === epoch` and returns without testing or pushing c. c is pruned from that walk: a frame without it, or, for a tile bake, a tile baked without it. The epoch should be global, or reset on join.
- evidence: read
- severity: medium

## Tile damage never covers where a copying container repaints a changed child
- where: packages/core/src/canvas/reach/reachTree.ts:97 (Tree.touched), :103 (report)
- scenario: a container whose `copiesFromPose` paints its children again at other offsets (a repeater), on a tiled layer. One child moves. `touched` records `{ reach: false }` for every id, and nothing ever sets `reach: true`, so only the child's own box is reported, before and after. The copies of the child, drawn through the container's `imagesOf` maps, land in tiles that are never marked stale, and they keep showing the old position. The images are folded only into the container's reach, which is never reported.
- evidence: read
- severity: medium

## Scene tile sources keep unbounded damage queues, and a second `tileSourceFor(layer)` orphans the first
- where: packages/core/src/canvas/reach/tileDamage.ts:46 (`queues.set(layer, queue)`), packages/core/src/canvas/buildSceneLayer.ts:295
- scenario: (1) `buildSceneLayer` calls `cfg.tileSourceFor(id)` for every tiled layer even when the consumer supplies `opts.damage`, so that layer's queue is never drained. The same happens to a layer that stops being tiled, or becomes a parallax plane. Every later change still pushes a `Float64Array` into its queue from any other layer's `ensure`, so memory grows without bound. (2) When the layer stack is rebuilt with the same wired slot, `tileSourceFor` replaces the layer's queue. Boxes already pushed into the old queue and not yet read are lost, and the new layer's tiles miss that damage. Queues should be bounded or dropped when unread, and a repeat call for a layer should keep its queue.
- evidence: read (callers inferred from buildSceneLayer.ts:290-300)
- severity: medium

## Pasting a group into a container on a higher layer retags only the root, leaving its children below their parent's layer
- where: packages/core/src/canvas/sceneClipboard.ts:262 (pasteSceneSnapshot, `layerOf`)
- scenario: copy a group on layer `back` whose children are on `back`, then paste into a container on `top` (`landing` names it), or onto a page on another layer. `layerOf` gives the root `top`, but every non-root item keeps `item.layer = back`. The scene's layer floor (`types.ts:168`: a child may not render below its parent) refuses the children's inserts, so the paste fails or partially lands. Descendants should be lifted to at least the root's new layer, as a cascading `setLayer` does.
- evidence: read (rule from scene types doc; enforcement on add inferred)
- severity: medium

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
