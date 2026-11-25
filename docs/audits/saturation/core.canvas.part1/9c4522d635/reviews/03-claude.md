## buildSceneLayer resolves derived paths from local poses on a composing adapter with no `toPose`, while the walk paints composed poses
- where: packages/core/src/canvas/buildSceneLayer.ts:113 (withAdapterDerivedPaths)
- scenario: a bare consumer calls `buildSceneLayer` with a `HierarchicalAdapter` that has `composePose` (nested frames) but no `getWorldPose` (the interface does not declare one) and no `cfg.toPose`/`cfg.derivedPathOf`. `adapterDerivedPathOf(adapter)` then reads each dependency through `adapter.getPose` — its local pose — while `buildSceneTree` folds `composePose` down the chain and paints every node at its world pose. A derived edge between two children of a moved group is drawn at their local coordinates, away from the nodes it connects. With a `toPose` the same adapter is routed through `toPoseReads`, which composes via `composeWorldPose`; the two branches answer "where is a dependency" differently. Should compose in both (use `toPoseReads`-style frames whenever `composePose` exists).
- evidence: read (adapterDerivedPath.ts:35 falls back to `getPose`; HierarchicalAdapter in buildSceneTree.ts has no `getWorldPose`; toPoseReads composes only on the `toPose` branch)
- severity: medium

## sceneContentBounds counts a consuming container's operands when that container is on a hidden layer and draws copies
- where: packages/core/src/canvas/contentBounds.ts:41 (sceneContentBounds)
- scenario: a node with both `consumesChildren: true` (e.g. a boolean group) and `copiesFromPose`, sitting on a layer with `visible: false`. `shown()` correctly returns `[]` for it (a consumer on a hidden layer paints nothing, and its operands are not drawn). The copies loop then computes `own = unionAabb(scene.childrenOf(node.id).flatMap(shown))` without checking `consumesChildren`, so the operands' boxes are carried through every copy into the content bounds. Zoom-to-fit and minimap frame content that is never painted. The branch should yield nothing for a consumer, as `shown` does.
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
