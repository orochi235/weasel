## WideChildren.meeting dedupes by a per-container epoch stored on the shared record, so a child can be skipped
- where: packages/core/src/canvas/reach/wideChildren.ts:66 (WideChildren.meeting / take)
- scenario: `epoch` starts at 0 in each `WideChildren`, but `rec.seen` lives on the `ReachRec`. Two cases: a container drops below `WIDE_AT / 2` and later grows back, so `fitWide` builds a new `WideChildren` at epoch 0 while its children keep `seen` from the old one's queries; or a child is reparented from one wide container to another whose epoch is one behind. When the new index's `++this.epoch` equals a child's stale `seen`, `take` returns before testing it. The child goes missing from `childrenMeeting`, so `buildSceneTree` prunes it for that frame (a one-frame flicker), and the same goes for a pick or collect query. Expected: an epoch that cannot collide across indexes, such as a global counter.
- evidence: read
- severity: medium

## Tile damage for a node moved between layers marks only its new layer, so the old layer keeps it in its tiles
- where: packages/core/src/canvas/reach/tileDamage.ts:37 (createSceneTileSources damage callback)
- scenario: the reach tree reports a touched node's box before applying a change and again after it, but by `ensure()` time the scene already holds the new state. A `setLayer` op moving node N from layer A to layer B therefore resolves `scene.get(id).layer` to B for both reports. The old box goes only to B's queue, A's tiles are never marked stale, and they keep showing N at its old place. Expected: the before-report damages the layer the node was on, or every layer when the old layer is unknown.
- evidence: read (sceneTouches notes `kit:setLayer` as a content touch of the id; reachTree.ensure reports `moved` before `apply`)
- severity: medium

## Tile damage ignores copies a container paints, so edits under a repeating container leave copy tiles stale
- where: packages/core/src/canvas/reach/reachTree.ts:83 (Tree.touched / report)
- scenario: `touched` reports only each touched node's own box (`reach: false`). A child of a container with `copiesFromPose` is also painted at each copy's transform, and the container's reach includes those images. When the child moves, only its untransformed own box is damaged. The container is not among the touched ids (only its child is), so the copy regions are never reported, and tiles there keep the old paint. Expected: a node under a copying ancestor also reports its box under each copy, or the ancestor's reach.
- evidence: read (reachBoxes.recompute unions images into the container's reach only; buildSceneTree visits children again under each copy)
- severity: medium

## A tiled layer's damage queue grows without bound while nothing drains it, and asking twice orphans the first queue
- where: packages/core/src/canvas/reach/tileDamage.ts:42 (returned per-layer function)
- scenario: every reach-tree report pushes a box (a fresh `Float64Array`) into every registered layer's queue, and a queue is emptied only by that layer's `damage.since()`. A layer that is hidden, or stops drawing tiled, is never asked again, yet its queue stays in `queues` and gains entries on every edit for the life of the slot. Calling the function a second time for the same layer replaces the map entry, so the first `SceneTileSource` stops receiving damage. Expected: a bounded queue (collapse to `'all'` past a cap) and one queue per layer.
- evidence: read
- severity: low

## readGl flips the read origin with `canvas.height`, not the drawing buffer's height
- where: packages/core/src/canvas/readback.ts:56 (createCanvasReader `now` → readGl)
- scenario: a context can clamp its drawing buffer below the canvas size (for example, a very large canvas at high DPR). Then `gl.drawingBufferHeight < canvas.height`, and `bufferHeight - rect.y - rect.height` reads rows offset by the difference. The loupe or eyedropper shows the wrong pixels. Expected: use `gl.drawingBufferHeight`, as renderSceneToPixels' prepareContext already treats the buffer as the real size.
- evidence: read
- severity: low

## createCanvasReader on WebGPU keeps whichever region read resolves last, not the latest one asked for
- where: packages/core/src/canvas/readback.ts:85 (createCanvasReader.region)
- scenario: the pointer moves and two `region()` calls are in flight. If the older readback resolves after the newer one, `last` is set to the older rect, and `pixel()` answers from stale data, or null for the current pointer. Expected: drop a result older than the latest request.
- evidence: read
- severity: low

## debugSnapshotArgs lets an explicit `annotations: undefined` override its default of true
- where: packages/core/src/canvas/renderDebugSnapshot.ts:52 (debugSnapshotArgs)
- scenario: `{ annotations: true, ...rest }`. A caller forwarding an optional field (`annotations: opts.annotations`) with no value spreads `annotations: undefined` over the default. `drawnLayers` then treats it as false and leaves annotation layers out, although the doc says the default is `true`. Expected: `annotations: rest.annotations ?? true`.
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

<!-- done: 7 findings, files read: 39 -->
