# Findings: core.canvas.part1

## buildSceneLayer's `toPose` shim spreads the adapter, dropping prototype methods, while `toPoseReads` in the same file binds them
- where: packages/core/src/canvas/buildSceneLayer.ts:225 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a caller passes `cfg.toPose` with an adapter that is a class instance (methods on the prototype, e.g. `getLayers`/`getNode`/`getChildren`/`composePose`). `{ ...a, getPose }` copies only own enumerable properties, so `buildSceneTree` calls `adapter.getLayers()` on an object without it and throws. Any method left that uses `this` also runs against the copy, not the adapter. `toPoseReads` (line 154) reads the same adapter through explicit delegates and `.bind(adapter)`, so the two paths in one file handle this differently. It should wrap by delegation, as `toPoseReads` does.
- evidence: read
- severity: low

## GestureReason places the refusal tag with the view and the element rect, ignoring the canvas's `clientToWorld` override that the dev HUDs honor
- where: packages/core/src/canvas/GestureReason.tsx:50 (GestureReason, the surface source's `toCanvas`)
- scenario: a `<SceneCanvas clientToWorld={…}>` whose input maps another way (the CSS transform the prop is documented for, or a 3D host). The dispatcher's `reason.at` is a world point from that mapping, but the tag goes back to the screen through `worldToScreen(viewToTransform(viewRef.current))` and `canvasToClient`, so it lands away from the pointer. `DevHuds` routes its readouts through `canvasApiRef.current.clientToWorld` so they "agree with the picks"; GestureReason answers the same question a second way.
- evidence: read (DevHuds.tsx:45 builds `toWorld` from the canvas API; GestureReason never reads it)
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
