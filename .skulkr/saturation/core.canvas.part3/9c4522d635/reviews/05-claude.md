# Findings: core.canvas.part3

## A node moved to another layer leaves its old layer's tiles stale
- where: packages/core/src/canvas/reach/tileDamage.ts:37 (createSceneTileSources, damage callback)
- scenario: a tiled scene with layers `a` and `b`; `setLayer(n, 'b')` on a node on `a`. `kit:setLayer` notes the node's id, so `Tree.ensure` reports its own box before applying and again after. The scene has already changed when the callback runs, so both reports resolve `scene.get(id).layer` to `'b'` and go only into `b`'s queue. `a`'s tiles never learn that the box the node used to paint in changed, so they go on showing the node at its old place on layer `a` until something else damages that area. The before-report should go to the layer the node was on, or to every layer.
- evidence: read (the `kit:setLayer` case in core/scene/sceneTouches.ts notes the id only; the callback looks the layer up at report time)
- severity: medium

## Tile damage ignores where a container's copies paint
- where: packages/core/src/canvas/reach/reachTree.ts:91 (Tree.touched / report), packages/core/src/canvas/reach/tileDamage.ts:36
- scenario: a container whose `copiesFromPose` paints its children again under affine copies. Moving a child names only the child, and `touched` reports only `own` boxes (`reach: false`), so damage covers the child's own box before and after the move. The container's reach, which `recompute` widens with the copies' images, changes, but nothing reports it. Tiles where the copies used to paint and now paint stay stale.
- evidence: read (inferred: assumes copies are drawn into the tiled layer like the source)
- severity: medium

## A removed layer's damage queue grows without bound
- where: packages/core/src/canvas/reach/tileDamage.ts:36-41 (createSceneTileSources)
- scenario: `queues` gets one entry per layer passed to the returned function, and never loses one. Once a tiled layer is removed (or the layers are rebuilt without it), nobody calls its `since()` again. Every rebuild (`'all'`) and every removed node, whose layer resolves `undefined`, still pushes onto that queue. Over a long session with node removals the array keeps growing, holding one `Float64Array` per push.
- evidence: read
- severity: low

## readGl places the read from the canvas height, not the drawing buffer's
- where: packages/core/src/canvas/readback.ts:51, :83 (readGl, createCanvasReader)
- scenario: a canvas sized past what the context can allocate gets a smaller drawing buffer (`drawingBufferHeight < canvas.height`), which renderSceneToPixels guards against explicitly. `now()` passes `canvas.height`, so `bufferHeight - rect.y - rect.height` reads from the wrong rows, or past the buffer. A loupe or eyedropper then gets the wrong pixels or transparent ones. The read should use `gl.drawingBufferHeight`.
- evidence: read
- severity: low

## stubCanvasContext replaces HTMLCanvasElement.prototype methods and never restores them
- where: packages/core/src/canvas/testing/stubCanvasContext.ts:6-42 (stubCanvasContext)
- scenario: a test calls `stubCanvasContext()`. `getContext`, `setPointerCapture` and `releasePointerCapture` stay overwritten on the shared prototype for every later test in the same worker file. The helper returns no restore, so a later test expecting jsdom's real behavior, or its own stub, sees this mock instead.
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

<!-- done: 5 findings, files read: 39 -->
