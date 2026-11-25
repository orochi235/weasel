# Findings: core.canvas.part1

## A composing adapter with no `toPose` and no `getWorldPose` derives paths from local poses while the walk paints world poses
- where: packages/core/src/canvas/buildSceneLayer.ts:122 (withAdapterDerivedPaths)
- scenario: `buildSceneLayer(cfg, adapter, …)` with no `cfg.toPose` and no `cfg.derivedPathOf`, over a `HierarchicalAdapter` that has `composePose` (local poses composed by the walk) but no `getWorldPose`. `withAdapterDerivedPaths` hands the raw adapter to `adapterDerivedPathOf`, whose `poseOf` falls back to `adapter.getPose(id)`: the dependency's *local* pose. `buildSceneTree` meanwhile paints every node at `compose(parentFrame, local)`. A derived edge between nodes nested in a moved container is drawn from their local coordinates, so it misses the nodes it connects (and the clip a derived container imposes is likewise misplaced). The `cfg.toPose` branch handles exactly this through `toPoseReads`, which builds a `getWorldPose` from `composePose`/`childFrame`; the no-`toPose` branch should do the same (e.g. always go through `toPoseReads` with `toPose = adapter.getPose` when the adapter composes and lacks `getWorldPose`). Same decision answered two ways depending on whether `toPose` was given.
- evidence: read (buildSceneLayer.ts:115-155, adapterDerivedPath.ts:35-37, buildSceneTree.ts visit fold)
- severity: medium

## The `toPose` shim spreads the adapter, dropping prototype methods of a class-based adapter
- where: packages/core/src/canvas/buildSceneLayer.ts:209 (buildSceneLayer draw, `hierarchicalAdapter = { ...a, getPose }`)
- scenario: a consumer passes an adapter that is a class instance (methods `getLayers`, `getNode`, `getChildren`, `composePose`, `childFrame`, `pickIdOf` on the prototype) together with `cfg.toPose`. `{ ...a }` copies only own enumerable properties, so `buildSceneTree` calls `adapter.getLayers()` on an object without it and throws (or, for the optional `composePose`/`childFrame`/`pickIdOf`, silently stops composing poses / carrying pick ids). Without `toPose` the same adapter works. `toPoseReads` in the same file already wraps by explicit delegation (`getNode: (id) => adapter.getNode(id)`, `.bind(adapter)`), which is the safe shape; the shim should delegate the same way (or use `Object.create(a)` with an own `getPose`).
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
