# Findings: core.canvas.part1

## buildSceneLayer derives a bare adapter's paths from local poses when the adapter composes, unlike its `toPose` branch
- where: packages/core/src/canvas/buildSceneLayer.ts:125 (withAdapterDerivedPaths)
- scenario: `buildSceneLayer` (exported through `barrel/renderer.ts`) is called with no scene-aware `derivedPathOf` and no `cfg.toPose`, over a `HierarchicalAdapter` that has `composePose` (local poses under frame-defining containers) and, like the interface, no `getWorldPose`. `withAdapterDerivedPaths` then passes the adapter straight to `adapterDerivedPathOf`, whose `poseOf` falls back to `adapter.getPose`, the local pose. A derived edge whose dependencies sit inside a translated group is drawn from their local coordinates, while `buildSceneTree` paints those same dependencies at their composed world poses: the edge misses the nodes it connects. With `cfg.toPose` set, the same function goes through `toPoseReads`, which composes the chain via `composeWorldPose`. Two answers to "where is a dependency drawn" depending on whether `toPose` is set. It should compose in both cases, e.g. by always routing through `toPoseReads(adapter, (obj) => adapter.getPose(obj.id))` when `composePose` is present.
- evidence: read (buildSceneLayer.ts:120-161, adapterDerivedPath.ts:35-37, buildSceneTree.ts HierarchicalAdapter has no getWorldPose)
- severity: medium

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

<!-- done: 1 findings, files read: 39 -->
