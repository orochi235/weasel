## A node moved to another layer never marks the old layer's tiles stale
- where: packages/core/src/canvas/reach/tileDamage.ts:37 (createSceneTileSources damage callback)
- scenario: a node on tiled layer A gets a `setLayer` op to B. `ReachTree.ensure` reports the node's own box before the change applies and again after, but the callback resolves the layer with `scene.get(id)?.layer`, which already reads B for both reports. Both boxes go only to B's queue, so A's tiles keep showing the node where it used to be. The "before" box should go to the layer the node had before the change, or to every queue.
- evidence: read (tree reports before and after apply; the feed is read after the scene mutated); that setLayer names the id rather than going `'unknown'` is inference
- severity: medium

## Tile damage ignores where a copying container paints its children again
- where: packages/core/src/canvas/reach/reachTree.ts:95 (Tree.touched / report)
- scenario: a group with `copiesFromPose` (a symmetry or repeat group) holds a child on a tiled layer. When the child moves, `touched` reports only the child's own box (`reach: false` on every entry), before and after. The copies drawn through the group's affines also move, but no box under any copy is reported, so tiles covering the copies stay stale. The same happens when the group's pose changes its copies' affines while the group's own box is empty. Each report should include the moved box's images under every `imagesOf` of each ancestor, or `'all'`.
- evidence: read (`touched` always sets `reach: false`; `imagesOf` is only consulted when reach is computed)
- severity: medium

## A tiled layer whose `since` is not polled grows its damage queue without bound
- where: packages/core/src/canvas/reach/tileDamage.ts:37,47 (queues / damage.since)
- scenario: two tiled scene layers share one tree. One is hidden or out of the painted set, so its `damage.since` is never called, while the other's `since` keeps calling `tree.ensure()`. Every change still pushes a `Float64Array` (or `'all'`) into the hidden layer's queue, so the queue grows for as long as the session edits. A queue holding an `'all'` could drop its boxes, or a long queue could collapse to `'all'`.
- evidence: read (push in callback, drained only by `splice` in that layer's own `since`); that a hidden layer's `since` is never polled is inference
- severity: low

## The WebGPU reader's cached region can be replaced by an older read
- where: packages/core/src/canvas/readback.ts:80 (createCanvasReader.region)
- scenario: on WebGPU, `region(r1)` and then `region(r2)` are both in flight, for example while a loupe follows the pointer. If r1's readback resolves after r2's, `last` ends up as r1, so `pixel()` for a point inside r2 answers null or r1's stale bytes. Only the most recently requested read should be allowed to set `last`.
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
