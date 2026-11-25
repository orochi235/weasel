# Findings: core.canvas.part1

## buildSceneLayer's `toPose` shim spreads the adapter, dropping prototype methods
- where: packages/core/src/canvas/buildSceneLayer.ts:212 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a caller passes `cfg.toPose` with an adapter that is a class instance (methods on the prototype). `{ ...a, getPose }` copies only own enumerable properties, so `buildSceneTree` calls `adapter.getLayers()` / `getChildren` / `getNode` on an object that lacks them and throws `getLayers is not a function`. Without `toPose` the same adapter works. `toPoseReads` in the same file handles this correctly, binding each method it forwards (`adapter.composePose?.bind(adapter)`, explicit `getNode`/`getChildren` wrappers), so the two shims answer the question two different ways. The fix is to build the shim from explicit forwarding calls, or as `Object.create(a)` with `getPose` overridden.
- evidence: read
- severity: low

## A bare scene slot's `shapes` reaches clips and LOD but not the painter lookup
- where: packages/core/src/canvas/buildSceneLayer.ts:192 (buildSceneLayer, `filteredDrawOne`) and :247 (the `objects` path)
- scenario: someone calls `buildSceneLayer` / `buildSceneLayers` directly with `cfg.shapes` set to a scene registry and `drawOne: defaultDrawOne`, and does not route through `sceneSlotWiring`. The slot passes `cfg.shapes` to `buildSceneTree` (for `clip: 'outline'`) and to `createLodWalk`. The ctx it hands `drawOne` is only `pixelScaleCtx(v, dpr)` plus `rung`, so `defaultDrawOne` → `findNodeShape(node, ctx?.shapes)` paints through `defaultNodeShapes`. A painter registered only in the scene's registry then clips and picks rungs but never paints, and a node it should claim falls through to a built-in painter. `<SceneCanvas>` avoids this only because `sceneSlotWiring` wraps `drawOne` in `withSceneShapes`.
- evidence: read (traced the `withSceneShapes` wrap in sceneSlotWiring.ts:66)
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
