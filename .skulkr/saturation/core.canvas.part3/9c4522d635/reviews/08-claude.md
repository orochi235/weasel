## A node moved to another layer never damages the tiles of the layer it left
- where: packages/core/src/canvas/reach/tileDamage.ts:37 (createSceneTileSources, damage callback)
- scenario: a tiled scene with layers A and B; `setLayer(n, 'B')` on a node drawn on A. `ensure` reports n's own box before the change and after, but the callback looks the layer up with `scene.get(id)?.layer` at report time, and both reports run after the scene already holds the new layer. Both boxes go to B's queue only; A's tiles keep the node's old pixels until something else invalidates them. The "before" box should go to the layer the node was on before the change (or to every queue).
- evidence: read (reachTree.ensure reports `moved` before `apply` but after the scene changed; `kit:setLayer` notes the id as content, so it takes this path rather than a rebuild)
- severity: medium

## Tile damage misses where a container's copies paint a moved child
- where: packages/core/src/canvas/reach/reachTree.ts:83 (Tree.touched / report)
- scenario: a group with `copiesFromPose` (a symmetry/repeat group) on a tiled layer; drag one of its children. Damage reports only the child's own box (`reach: false`) before and after, in world space where the original draws. buildSceneTree paints the child again under each copy transform (buildSceneTree.ts:202), and those copies' old and new positions are never reported, so tiles holding the copies stay stale. The container's reach (which `recompute` widens by `imagesOf`) moves but is not reported either.
- evidence: read (inference that tiled baking draws copies the same way the walk does)
- severity: medium

## Pasting a multi-level cluster into a container on a higher layer throws
- where: packages/core/src/canvas/sceneClipboard.ts:268 (pasteSceneSnapshot, layerOf)
- scenario: copy a group G on layer `bg` with a child C on `bg`; paste with `landing()` naming a container K on layer `fg` above `bg`. `layerOf` gives the root G K's layer `fg`, but C is not a root and keeps `bg`. Inserting C under G then puts a child below its parent's layer, which the scene refuses ("a child may not render below its parent's layer", layerStack.ts:93), so the paste's insert ops throw partway. Descendants on a layer below their re-layered root need lifting with it.
- evidence: read
- severity: medium

## renderDebugSnapshot's `annotations` default is lost when the key is present but undefined
- where: packages/core/src/canvas/renderDebugSnapshot.ts:51 (debugSnapshotArgs)
- scenario: a caller forwarding an optional `annotations: opts.annotations` (undefined) spreads `...rest` after `annotations: true`, so `annotations` becomes undefined and drawnLayers hides the annotation layers, contrary to the documented default `true`. Should be `annotations: rest.annotations ?? true`.
- evidence: read
- severity: low

## stubCanvasContext overwrites HTMLCanvasElement.prototype methods with no way back
- where: packages/core/src/canvas/testing/stubCanvasContext.ts:6 (stubCanvasContext)
- scenario: a test calls it; `getContext`, `setPointerCapture`, `releasePointerCapture` are assigned (not `vi.spyOn`), so `vi.restoreAllMocks` does not restore them and every later test in the same worker/file sees the stub, including ones that expect jsdom's real `getContext` (null) to take a no-WebGL path.
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
