# Findings: core.canvas.part3

## Tile damage reports only a touched node's own box, so tiles showing a container's copies of it stay stale
- where: packages/core/src/canvas/reach/reachTree.ts:91 (Tree.touched / Tree.report), consumed by packages/core/src/canvas/reach/tileDamage.ts:36
- scenario: a tiled scene layer holds a container whose `copiesFromPose` paints its children again at other offsets (a repeat/array). Move or recolor one child. The feed names the child (and its descendants), and `touched` turns each into `{ reach: false }`, so `report` damages only the child's own box before and after. The container is not in the touched set unless it is child-derived, and even when it is, only its own box is reported, never the copy images that `ReachBoxes.recompute` folds into its reach (`imagesOf`). The tiles holding the copies are never marked stale, so they keep showing the old child until something else dirties them. It should also report where each copy's image of the moved box lands: the copying ancestors' reach before and after, or the copy images of the child's box. The `reach` flag on each entry is always false, so that path is never taken.
- evidence: read (traced `touched` → `report` → the tileDamage callback, and `sceneTouches.reached`, which widens only to descendants, dependents and child-derived containers)
- severity: medium

## A tile source's per-layer damage queue grows without bound when that layer stops calling `since`
- where: packages/core/src/canvas/reach/tileDamage.ts:36 (createSceneTileSources damage callback) and :44 (`queues.set`)
- scenario: two scene layers are tiled from one `tileSourceFor`. Layer B is hidden, or drops out of `cfg.tiles`, so its tile host no longer calls `B.damage.since()`. Layer A keeps calling `since()`/`bounds()`, which run `tree.ensure()`, and every damage box with an undefined layer, or B's layer, is pushed onto B's queue. Nothing drains or drops that queue, and `queues` never removes a layer's entry, so it grows by one `Float64Array` per change for the life of the slot. It should be capped (for example, collapse to `'all'` past N entries) or dropped when its layer stops being tiled.
- evidence: read
- severity: low

## `debugSnapshotArgs` drops annotations when the caller passes `annotations: undefined`
- where: packages/core/src/canvas/renderDebugSnapshot.ts:52 (debugSnapshotArgs)
- scenario: a caller forwards an optional flag, `renderDebugSnapshot({ ...args, annotations: opts.annotations })`, with `opts.annotations` unset. `{ annotations: true, ...rest }` copies the own `undefined` over the default, and `drawnLayers` reads it as falsy and hides every annotation layer. The documented default is `true` ("as the canvas did"). Use `annotations: rest.annotations ?? true` after the spread.
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

<!-- done: 3 findings, files read: 39 -->
