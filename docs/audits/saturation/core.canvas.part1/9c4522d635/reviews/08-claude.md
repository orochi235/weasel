# Findings: core.canvas.part1

## buildSceneLayer's `toPose` shim spreads the adapter, dropping every prototype method
- where: packages/core/src/canvas/buildSceneLayer.ts:244 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a slot with `cfg.toPose` set, over an adapter whose methods live on a prototype (a class instance, or an object made with `Object.create`). `{ ...a, getPose }` copies only own enumerable properties, so `getLayers`, `getNode`, `getChildren`, `composePose`, `childFrame` and `pickIdOf` are gone; `buildSceneTree` then throws on `adapter.getLayers()`, or silently drops composition and pick ids where only the optional ones were on the prototype. The same file's `toPoseReads` (line 164 on) reads the adapter through method calls and `.bind`, so the two paths answer the question "how do I wrap this adapter" differently. It should delegate (`getLayers: () => a.getLayers()`, bound optionals) the way `toPoseReads` does.
- evidence: read (every adapter in-tree is an object literal today, so no in-tree caller hits it; `HierarchicalAdapter` is an interface any adapter can implement)
- severity: low

## commandRasterizer assumes the page view is axis-aligned
- where: packages/core/src/canvas/commandRasterizer.ts:47 (commandRasterizer)
- scenario: a `view` GlMat3 that rotates or skews (nonzero `[1]`/`[3]`), or flips an axis. `sx = toRaster[0]` and `sy = toRaster[4]` are taken as the scale, and the source rect is `-t / s`. Under a rotation those entries are `s·cosθ`, so the session's source rect and `scale` are wrong and `world`-unit paint resolves at the wrong size and place; at 90° `sx` is 0, which divides by zero. A negative scale gives a negative-width source rect. It should decompose the matrix, or refuse a view that is not scale-and-translate.
- evidence: read (inference: I found no rotating page-view caller)
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
