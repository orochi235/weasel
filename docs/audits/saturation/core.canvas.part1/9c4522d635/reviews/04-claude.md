# Findings: core.canvas.part1

## The adapter pick walk picks a child id the adapter has no node for, which the paint walk skips with its subtree
- where: packages/core/src/canvas/adapterPickSource.ts:40 (nodeOf), :55 (order/visit)
- scenario: an adapter whose `getChildren` lists an id that `getNode` answers `undefined` for (a child list updated before the node table, a deleted id still listed). `buildSceneTree.visit` returns on `!node` and paints nothing for it or anything under it (buildSceneTree.ts `if (!node || hidesSubtree(node)) return;`). `adapterPickSource.nodeOf` spreads `undefined` into `{ id, pose: worldPose(id) }`, so the walk emits a candidate with no `kind`/`layer`/data, reads `getPose` for an unknown id, and recurses into its children. The pick can then hit, or hand to `centersBetween`, something that is not drawn. It should skip the id and its subtree, as the paint walk does.
- evidence: read
- severity: low

## The scene slot's `objects` path records debug bounds for culled nodes and records origins at the stored pose, unlike the tree path
- where: packages/core/src/canvas/buildSceneLayer.ts:245 (buildSceneLayer, `cfg.objects` branch) against :199 (filteredDrawOne)
- scenario: with `debug` on and `cull: true`, a node the cull skips gets no `recordBounds`/`recordOrigin` on the tree path, because only `filteredDrawOne` records and the painter is never called. On the `objects` path the record sits outside the `!culled?.(obj, at)` guard, so the overlay boxes nodes that were not painted. Also, the tree path records the origin at the pose handed to the painter, which is the drawn pose (`drawnPose` applied). The `objects` path records `pose` rather than `at`, so under a quantize rule the debug origin is off by the snap. The same question gets two different answers on two paths.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/Canvas.tsx
packages/core/src/canvas/CanvasView.tsx
packages/core/src/canvas/CursorCoordsHud.tsx
packages/core/src/canvas/DrawCanvas.tsx
packages/core/src/canvas/GestureReason.module.css
packages/core/src/canvas/GestureReason.tsx
packages/core/src/canvas/ModalityHud.tsx
packages/core/src/canvas/NodeShape.ts
packages/core/src/canvas/PickHud.tsx
packages/core/src/canvas/SceneCanvas.tsx
packages/core/src/canvas/SceneViewCanvas.tsx
packages/core/src/canvas/SurfaceCanvas.tsx
packages/core/src/canvas/ViewMarker.tsx
packages/core/src/canvas/accentColor.ts
packages/core/src/canvas/adapterDerivedPath.ts
packages/core/src/canvas/adapterPickSource.ts
packages/core/src/canvas/affordanceAt.ts
packages/core/src/canvas/ambientContributions.tsx
packages/core/src/canvas/bestHitPicker.ts
packages/core/src/canvas/buildSceneLayer.ts
packages/core/src/canvas/buildSceneTree.ts
packages/core/src/canvas/canvasBackend.ts
packages/core/src/canvas/canvasBackendContext.ts
packages/core/src/canvas/canvasExtension.ts
packages/core/src/canvas/canvasProps.ts
packages/core/src/canvas/canvasRenderer.ts
packages/core/src/canvas/canvasViewProps.ts
packages/core/src/canvas/centersBetween.ts
packages/core/src/canvas/commandRasterizer.ts
packages/core/src/canvas/contentBounds.ts
packages/core/src/canvas/contextAttributes.ts
packages/core/src/canvas/copiesAbove.ts
packages/core/src/canvas/defaultDrawOne.ts
packages/core/src/canvas/derivedPath.ts
packages/core/src/canvas/devtoolsLabel.tsx
packages/core/src/canvas/doubleClickTarget.ts
packages/core/src/canvas/drawEnvelope.ts
packages/core/src/canvas/drawnBounds.ts
packages/core/src/canvas/gestureBounds.ts

<!-- done: 2 findings, files read: 39 -->
