# Findings: core.canvas.part1

## buildSceneLayer's `toPose` shim spreads the adapter, dropping prototype methods
- where: packages/core/src/canvas/buildSceneLayer.ts:226 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a consumer passes `buildSceneLayer` (or `<SceneCanvas>` a slot config with `toPose`) an adapter implemented as a class instance, so `getLayers`, `getNode`, `getChildren`, `composePose` and `childFrame` live on its prototype. With `cfg.toPose` set, `{ ...a, getPose }` copies only own enumerable properties, so `buildSceneTree` calls `adapter.getLayers()` on an object without it and throws on the first draw. Without `toPose` the same adapter paints. `toPoseReads` in the same file wraps each method explicitly and handles this case. The shim should wrap the adapter the same way rather than spreading it.
- evidence: read (no class adapter exists in the repo today; the slot's `HierarchicalAdapter` contract is an interface, so a class satisfies it)
- severity: low

## Dev HUDs decide "in canvas" from the bounding rect, while world coords come from the layout box or `toWorld`
- where: packages/core/src/canvas/PickHud.tsx:72 (PickHud onMove); packages/core/src/canvas/CursorCoordsHud.tsx:104 (CursorCoordsHud onMove)
- scenario: a canvas under a rotated or skewed CSS transform, which is exactly the case the `toWorld` prop documents. `getBoundingClientRect()` returns the transformed element's axis-aligned hull, so a pointer in a corner of that hull but outside the canvas counts as `inCanvas`. PickHud then runs `pickEvery` there and lists the nodes it finds, and CursorCoordsHud drops its "off-canvas" tag, even though the canvas's own routing (`layoutBoxOf`/`toWorld`) puts the point outside the surface. The containment test should use the same conversion as the world point.
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
