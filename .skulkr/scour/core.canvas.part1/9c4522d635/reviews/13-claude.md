# Findings: core.canvas.part1

## `buildSceneLayer` drops an adapter's prototype methods when the slot has a `toPose`
- where: packages/core/src/canvas/buildSceneLayer.ts:226 (buildSceneLayer, `hierarchicalAdapter` shim)
- scenario: a caller passes a class-instance adapter (methods `getLayers`, `getNode`, `getChildren`, `composePose`, `childFrame`, `pickIdOf` on the prototype) together with `cfg.toPose`. `{ ...a, getPose }` copies only own enumerable properties, so `buildSceneTree` calls `adapter.getLayers()` on an object without it and throws (or silently loses `composePose`/`childFrame`/`pickIdOf`, so frames do not compose and nodes carry no `pickId`). The same adapter without `toPose` paints fine. `toPoseReads` in the same file binds each method explicitly for this reason; the draw-path shim should do the same (wrap the adapter, delegating each member, or use `Object.create(a)` with `getPose` overridden).
- evidence: read (no class-based adapter in production code found by grep; the interface admits one)
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

<!-- done: 1 findings, files read: 39 -->
