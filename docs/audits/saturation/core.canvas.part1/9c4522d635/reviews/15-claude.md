# Findings: core.canvas.part1

## A composing adapter with no `getWorldPose` derives paths from local dependency poses while the walk paints composed ones
- where: packages/core/src/canvas/buildSceneLayer.ts:124 (withAdapterDerivedPaths), with packages/core/src/canvas/adapterDerivedPath.ts:34 (poseOf)
- scenario: a bare `HierarchicalAdapter` that has `composePose` (local child poses) but no `getWorldPose`, with no `cfg.toPose` and no `derivedPathOf`, holds a derived edge between two nodes inside a translated frame. `buildSceneTree` folds each node's pose through `composePose` and paints the endpoints at their world poses. The derived path is resolved through `adapterDerivedPathOf(adapter)`, whose `poseOf` falls back to `adapter.getPose`, the local pose. So the edge is drawn at the un-composed positions, offset from the nodes it connects. The `cfg.toPose` branch of the same function (`toPoseReads`) does compose through `composePose`/`childFrame`, so the same question gets two answers depending on whether `toPose` is set. It should compose whenever the adapter has `composePose`, the same way `toPoseReads` does. `adapterPickSource.worldPose` (adapterPickSource.ts:37) has the same fallback, so picking such an adapter also tests nodes at local poses while they are drawn composed.
- evidence: read
- severity: medium

## `nodeShapeEntries` documents an evaluation order that contradicts the module's
- where: packages/core/src/canvas/NodeShape.ts:271 (nodeShapeEntries)
- scenario: the docstring says the order is "'high' tier first, then 'normal', then the rect fallback". The module header (and `setBuiltInShapes`) says it is 'high', then the built-ins (`kit:derived`, path, shape, image), then 'normal', then two fallbacks (`kit:path-pose`, then `kit:rect-fallback`). A caller who trusts the docstring will expect a 'normal' painter to beat the built-in path/shape/image painters, and it doesn't.
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
