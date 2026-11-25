# Audit round 39 — core.canvas.part2

## pixelPickEvery returns its hits unsorted when a later pass cannot read
- where: packages/core/src/canvas/pixelPick.ts:41 (pixelPickEvery)
- scenario: a pick whose first pass reads ids and whose second pass gets `null` (or a 0×0 buffer, e.g. the context is lost or the canvas resized to nothing between passes) returns `found` straight away, in the order pick ids appeared in the first buffer's rows, not back-to-front by `orderOf` as the doc and the normal exit (`found.sort(...)` at line 52) promise. A caller taking `.at(-1)` as topmost gets whichever node sat in the last scanned pixel row.
- evidence: read
- severity: low

## createCanvasReader creates a WebGL2 context on a canvas whose backend is not chosen yet
- where: packages/core/src/canvas/readback.ts:75-78 (createCanvasReader → now)
- scenario: `canvasPaintsWith(canvas)` is `undefined` until the canvas's first renderer is built, and with `backend: 'auto'` (or `'webgpu'`) that waits on the async device request (`BackendChoice` `'wait'`). A hud loupe (`packages/hud/src/loupe/pixelReadback.ts`) that reads a region or pixel in that window reaches `canvas.getContext('webgl2')`, which *creates* a WebGL2 context. A canvas holds one context kind for life, so when the device lands the WebGPU renderer's `getContext('webgpu')` returns null and the canvas paints nothing (or must fall back). It should answer null while no backend is recorded rather than probe with a context-creating call.
- evidence: read (canvasBackend.ts:64 `canvasPaintsWith` is `CHOSEN.get(canvas)`, set only by `rememberBackend`)
- severity: medium

## A copy with a page selected drops the hidden sources of a derived node on that page, and the paste then omits the node
- where: packages/core/src/canvas/sceneClipboard.ts:66,104,114 (snapshotSceneSelection → covered / carrySources)
- scenario: `covered` asks `holderOf(idSet, …)` over the raw selection, page ids included, while what is actually captured is `copiedRoots(scene, ids)`, which strips pages and the page run (`withoutPageStructure`, "a page selected with its content does not swallow that content"). Select page P and a visible derived node D on P whose source H is a hidden node on P (not itself selected). `copiedRoots` → [D]; `carrySources(D)` skips H because P "covers" it, yet P is never copied, so H is not in the snapshot. `pasteSceneSnapshot`'s `omissions` then drops D as `dependency-not-copied`, and the paste lands nothing for a node the user selected. Without P in the selection the same copy carries H and pastes D. `covered` should test against the copied roots (the ids after `withoutPageStructure`), not the raw `ids`.
- evidence: read (selectionSubtree.ts:12-16 `rootsAmong`; nodeGates.ts:57 `withoutPageStructure`)
- severity: medium

## A SceneCanvas that mounts while a paint stand-in is already shown paints the node in full under it
- where: packages/core/src/canvas/paintStandIns.ts:73-80 (useStandInLayers)
- scenario: the memo reads `elementRef.current`, which is `null` during a component's first render (SceneCanvas.tsx:105 passes `internalCanvasRef`, set at commit). Its deps are `[layers, scene, elementRef, at]`, and the ref object never changes, so after mount nothing recomputes until the stand-in registry's version moves. A canvas of the scene mounting inside a container whose text editor already called `standIn.show(id)` (a second view opening mid-edit, a remount by `key`, a canvas inside `hostTextEditors`' container appearing after the edit began) gets `standIns` empty and paints the edited node's glyphs in full beneath the overlay's, doubled, until something else shows or hides a stand-in. It should re-read once the element is attached (e.g. a layout-effect version bump or state set from the ref).
- evidence: read
- severity: low

## A paste at a drop point measures the cluster's origin from derived nodes' placeholder poses
- where: packages/core/src/canvas/sceneClipboard.ts:233-248 (pasteSceneSnapshot, drop-point policy)
- scenario: the cluster origin is the min corner of `env.poseBounds(item.pose, item)` over every root, and a node that derives its path (a diagram edge, `packages/diagram/src/connect.ts:212`, `dataEdges.ts:92`, a path-effect result, `core/scene/pathEffects/derive.ts:145`) stores a placeholder pose `{ x: 0, y: 0, width: 0, height: 0 }` its path does not follow. Copy two boxes at (500, 500) and (700, 500) with the edge between them, paste with `ctx.dropPoint = (100, 100)`: `minX = minY = 0` from the edge, so `dx = dy = 100` and the boxes land at (600, 600) and (800, 600), not at the drop point; the further the copied content is from the origin, the further off it lands. Roots that derive their path (`derivePath` with dependencies, the same test `derivesPathOnly` in selectionSubtree.ts makes) should be left out of the origin, or measured by their derived path. `pagedLandings` already passes followers over for the same reason.
- evidence: read
- severity: medium

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

<!-- done: 5 findings, files read: 47 -->
