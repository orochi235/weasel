# Findings — core.canvas.part2

## pixelPickEvery returns its hits unsorted when a later pass cannot read
- where: packages/core/src/canvas/pixelPick.ts:41 (pixelPickEvery)
- scenario: pass 0 reads ids and finds nodes A (front) and B (back) in buffer order; pass 1's `readIds` returns `null` (context lost, frame dropped) or an empty buffer → the early `return pass === 0 ? null : found` hands back `found` in buffer-scan order, skipping the `found.sort(orderOf)` the normal exit applies. The documented contract is back-to-front by `orderOf`; a caller taking the last element as topmost (as `topmostOf` does) picks the wrong node. Should sort on that exit too.
- evidence: read
- severity: low

## createCanvasReader claims an unrendered canvas for WebGL2 by asking it for a context
- where: packages/core/src/canvas/readback.ts:75-79 (createCanvasReader → now)
- scenario: `canvasPaintsWith(canvas)` is `undefined` until the canvas's first renderer is built (`canvasBackend.ts:63`), and a WebGPU renderer is built only after an async adapter request. A loupe or eyedropper reading `region`/`pixel` in that window (or before the renderer mounts) reaches `canvas.getContext('webgl2')`, which *creates* a WebGL2 context with default attributes on the bare canvas. The renderer's later `getContext('webgpu')` then returns null (a canvas holds one context kind), or a WebGL renderer gets back the reader's context with the wrong attributes instead of its own. Should treat an undefined backend as "cannot answer" (null) rather than calling `getContext`.
- evidence: read
- severity: medium

## useStandInLayers reads the canvas ref during render, so a canvas mounting under an already-shown stand-in never applies it
- where: packages/core/src/canvas/paintStandIns.ts:73-80 (useStandInLayers)
- scenario: `SceneCanvas.tsx:105` passes `internalCanvasRef`, which React fills only at commit, so on a canvas's first render `elementRef.current` is null and the memo answers with no stand-ins. The memo recomputes only when `layers`, `scene`, the ref object or the registry `version` changes. With `layers` omitted (undefined, stable) and a stand-in already shown when the canvas mounts — a second canvas of the scene (split view, minimap) mounting inside the stand-in's `within` while a text edit is open, or a canvas remounted mid-edit — nothing ever recomputes it: the canvas paints the node's full paint (the glyphs) under the editing overlay that also draws them, until some stand-in is shown or hidden. Should re-read after mount (e.g. bump on a layout effect) rather than read the ref in render.
- evidence: read
- severity: low

## The layer sampler renders with no view matrix, so a `units: 'world'` gradient is sampled in screen space
- where: packages/core/src/canvas/layerSample.ts:95 (createLayerSampler → rgba), via packages/core/src/canvas/renderSceneToPixels.ts:304 (renderCommands)
- scenario: `renderCommands` calls `r.render(commands, undefined, …)`, and `planLayerSample` returns only `screen`, never the world→raster matrix. The renderer places a `units: 'world'` gradient through `ctx.viewMatrix` and, absent one, falls back to `screenMatrix` (`renderer/src/draw/gradient.ts:168-169`). The on-screen canvas draws with a view matrix. So with the view panned or zoomed (anything but identity), a loupe/eyedropper sample over a node filled or stroked with a world-unit linear/radial gradient reads the gradient as if its stops were in CSS px from the canvas corner: a color that differs from the pixel on screen, which the module promises to match exactly. The on-screen paths all pass `viewToMat3(view)` (`canvasRenderer.ts:339`, `useCanvasPaint.ts:148`); the plan should carry the same world matrix, expressed in the raster's frame alongside `screen`, and `renderCommands` should accept and pass it.
- evidence: read
- severity: medium

## renderDebugSnapshot at `pixelRatio` > 1 draws every `{ px }` length at a fraction of its on-screen size
- where: packages/core/src/canvas/renderDebugSnapshot.ts:50-61 (debugSnapshotArgs)
- scenario: `renderDebugSnapshot({ …, pixelRatio: devicePixelRatio /* 2 */ })`, documented as "what the screen showed". It folds `pixelRatio` into `scale` and scales the overlay group, but the headless path treats one output pixel as one CSS pixel: `planPixelRender` builds the walk at density 1 ("one output pixel per 'CSS' pixel", `renderSceneToPixels.ts:80-81`), the session's renderer runs at `dpr: 1` (`:256`), and no `screen` is passed (`renderSceneToPixelsTypes.ts:83-85`). A `{ px }` length resolves against the view scale, which now includes `pixelRatio`. On the canvas a `{ px: 1 }` hairline, a `{ px }` stroke or font size, and the overlay's px-sized strokes are 1 CSS px = 2 device px; in the snapshot they come out 1 output px, half as thick or tall, while the geometry around them is full size. So the snapshot does not show what the screen showed. The density needs to reach the walk and the renderer (and `screen`), not only `scale`.
- evidence: read
- severity: medium

## After pick ids run out, an adopted number still on the free list goes to a second node while its own is live
- where: packages/core/src/canvas/scenePickIds.ts:44-52, 60-67 (createScenePickIds: adopt, pickIdOf)
- scenario: once every number is given, `reclaim` lists the dead numbers in `free`. A later `adopt(id, n)` with an `n` on that list (a worker copy taking the original's numbering after the original reused a dead number) puts `id` at `byPick[n]` but leaves `n` in `free`. The next `pickIdOf(other)` pops `n`, finds `held = id`, and `byNode.delete(id)`, handing a live node's number to `other`. `idOfPickId(n)` now names `other` while the worker still paints `id` with `n`, so a pixel pick on `id` selects `other`. The interface promises a number is kept while the node is in the scene. The free path should skip a number whose holder is live, or `adopt` should take `n` off `free`.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/mountedCanvases.ts
packages/core/src/canvas/nodeOutline.ts
packages/core/src/canvas/nodeShapeRegistry.ts
packages/core/src/canvas/nodeShapeTypes.ts
packages/core/src/canvas/overChildren.ts
packages/core/src/canvas/overlayRoleStrokes.ts
packages/core/src/canvas/ownClip.ts
packages/core/src/canvas/paintCull.ts
packages/core/src/canvas/paintOverrides.ts
packages/core/src/canvas/paintStandIns.ts
packages/core/src/canvas/paintedCursorLayer.ts
packages/core/src/canvas/pasteOnPages.ts
packages/core/src/canvas/pasteShape.ts
packages/core/src/canvas/pathOverlay.ts
packages/core/src/canvas/pbt.fixture.ts
packages/core/src/canvas/pickIndex/nodeBroadBox.ts
packages/core/src/canvas/pickIndex/pickIndexFixture.ts
packages/core/src/canvas/pickIndex/scenePickIndex.ts
packages/core/src/canvas/pickReach.ts
packages/core/src/canvas/pickWalk.ts
packages/core/src/canvas/pixelPick.ts
packages/core/src/canvas/pixelRenderRect.ts
packages/core/src/canvas/pixelScale.ts
packages/core/src/canvas/planeClips.ts
packages/core/src/canvas/poseRotation.ts
packages/core/src/canvas/pressTarget.ts
packages/core/src/canvas/publishPreviews.ts
packages/core/src/canvas/rasterReadback.ts
packages/core/src/canvas/rasterToPng.ts
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

<!-- done: 6 findings, files read: 47 -->
