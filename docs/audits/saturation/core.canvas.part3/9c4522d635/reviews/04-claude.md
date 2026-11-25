# Findings: core.canvas.part3

## Visibility index keeps stale layer tag bits after a layer reorder, so it prunes the wrong layer's nodes
- where: packages/core/src/canvas/reach/sceneVisibility.ts:110 (SceneVisibility.tagOf) and :160 (sceneReachSource.tagsOf)
- scenario: a node's tag is `1 << tagOf(node.layer)`, read once into its reach record (`readOwn`) and re-read only when that node is touched. `tagOf` remaps bits whenever `scene.layers` changes identity, but a layer's own op (reorder/"place") notes only the layer id in the touches journal (`sceneTouches.ts:99-101`), which names no node, so no record re-reads its tags. After swapping layers A (index 0) and B (index 1), A's nodes still carry bit 0, which now means B. A walk painting only A (a `forLayer` walk, a tile bake, or B hidden) asks for bit 1 with A's region, so A's nodes fail `boxMeets` and their subtrees are pruned and never painted, while B's nodes are tested against A's region. With parallax views per layer, both get tested against the other's region. The tree should rebuild, or retag, when the layer stack changes.
- evidence: read (sceneVisibility tagOf/tagsOf, reachBoxes.readOwn, sceneTouches.noteOp default case)
- severity: high

## A node moved to another layer reports its old box only to its new layer's tiles
- where: packages/core/src/canvas/reach/tileDamage.ts:42 (createSceneTileSources damage callback)
- scenario: `Tree.ensure` reports each touched node's box before applying the change and after it, but by then the scene already holds the change. The callback looks up `scene.get(id)?.layer` for both reports. On `setLayer` from L1 to L2, the "before" box (where the node was painted on L1) is pushed to L2's queue only. L1's tiles at that spot are never marked stale, so the node stays baked into L1's tiles as a ghost. The before-report should go to the layer the node was on.
- evidence: read
- severity: medium

## Tile damage leaves out the copies a container paints, so moving a copied child leaves stale copies in the tiles
- where: packages/core/src/canvas/reach/reachTree.ts:83 (Tree.touched / report)
- scenario: damage reports only each touched node's *own* box (`reach: false` for every entry). A container with `copiesFromPose` paints its children again under each copy, and the reach tree accounts for that (`imagesOf` in `ReachBoxes.recompute`). But when a child moves, only the child's own box, before and after, is reported. The container is not in the touched set, so the copies' images of the old and new boxes are never reported. Tiles holding the copies keep the old content. The damage needs the container's copies (or its reach, before and after) to be reported too.
- evidence: read (touched/report; inferred that copies paint outside the child's own box, as recompute's imagesOf says)
- severity: medium

## Paste in a non-composing scene leaves a pasted group's children behind the group
- where: packages/core/src/canvas/sceneClipboard.ts:259 (pasteSceneSnapshot ridesPastedFrame / placed), :78 (poseFor)
- scenario: `ridesPastedFrame` treats any pasted ancestor for which `definesFrame` holds (every non-envelope group) as carrying its children, and pastes those children at their copied pose with no offset. `definesFrame` does not look at the scene's composition, and neither does `frameAtOrAbove` (composeFrame.ts:169). In a scene whose composition does not compose (absolute poses), a child's pose is absolute, so nothing carries it. Copy a plain group with children and paste: the group moves by the paste offset (or to the drop point), and its children land exactly on the originals. The check should apply only when `composesFrames(scene.composition)`.
- evidence: read; inferred that non-envelope groups occur in non-composing scenes
- severity: medium

## Wide-container `childrenMeeting` ignores the `children` it is given
- where: packages/core/src/canvas/reach/reachTree.ts:204 (Tree.childrenMeeting)
- scenario: the contract is "those of `children` … in order", and the narrow path filters `children`. The wide path instead answers from the container's whole index, sorted by rank, and `rankChildren` ranks by position in the caller's list. A caller passing a subset or a reordered list (the method is on the public `ReachTree`) gets back ids it did not pass, and ranks computed from the wrong list, which then persist (`ranksStale = false`) for later calls. Today buildSceneTree passes the full `getChildren` list, so the scene walk itself is unaffected.
- evidence: read
- severity: low

## WebGPU readback: an earlier region read that resolves late overwrites `last`
- where: packages/core/src/canvas/readback.ts:86 (createCanvasReader.region)
- scenario: each async region read sets `last` when its promise resolves. If a loupe asks for region A and then region B as the pointer moves, and A's readback resolves after B's, `last` holds A. `pixel()` at the current pointer, inside B, then answers null, or a stale pixel where A and B overlap. Only the most recent request should be allowed to write `last`.
- evidence: read
- severity: low

## Tile sources keep a damage queue per layer forever, and it grows while that layer is not read
- where: packages/core/src/canvas/reach/tileDamage.ts:40 (queues)
- scenario: every call to the returned function registers a queue in `queues`, and nothing removes one. Each `ensure` (from any layer's `bounds`/`since`) pushes every damage box into every queue. A layer whose tiling was turned off, or a source asked for once, keeps accumulating Float64Array boxes for every edit for as long as another tiled layer of the same wiring is read. Nothing bounds it.
- evidence: read
- severity: low

## `stubCanvasContext` replaces HTMLCanvasElement prototype methods with no way back
- where: packages/core/src/canvas/testing/stubCanvasContext.ts:5 (stubCanvasContext)
- scenario: it overwrites `getContext`, `setPointerCapture` and `releasePointerCapture` on the shared prototype and returns nothing to restore them. Its 2D-shaped stub is returned for every context id, `'webgl2'` included. Later tests in the same worker see the stub, so code probing `getContext('webgl2')` gets a fake 2D object instead of null. Test teardown leaves the state behind.
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

<!-- done: 8 findings, files read: 39 -->
