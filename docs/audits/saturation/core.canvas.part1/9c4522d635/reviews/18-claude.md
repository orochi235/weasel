# Findings: core.canvas.part1

## A composing adapter without `getWorldPose` derives paths from local poses when the slot has no `toPose`
- where: packages/core/src/canvas/buildSceneLayer.ts:122 (withAdapterDerivedPaths)
- scenario: `buildSceneLayer` is given a `HierarchicalAdapter` that composes poses (`composePose` present, the interface's own way of saying poses are local) but no `getWorldPose` (which `HierarchicalAdapter` does not declare), and `cfg.toPose` is unset. `adapterDerivedPathOf(adapter)` then reads each dependency through `adapter.getPose`, the local pose, so an edge between two children of a moved group is derived at their local coordinates and painted away from the nodes it joins. The `toPose` branch of the same function builds a composing `getWorldPose` through `toPoseReads`/`composeWorldPose`, so the two branches answer "where is a dependency" differently. Expected: the no-`toPose` branch composes through `composePose` the same way when the adapter has no `getWorldPose`.
- evidence: read (adapterDerivedPath.ts:34-35 falls back to `getPose`; buildSceneTree composes on the walk, so painted poses are world while the derivation's are local)
- severity: medium

## The `objects` path records debug origins at the stored pose, and for culled nodes, where the tree path records the drawn pose of painted nodes only
- where: packages/core/src/canvas/buildSceneLayer.ts:232-247 (buildSceneLayer, `cfg.objects` branch)
- scenario: a scene slot with `drawnPose` (a quantize rule) and `cfg.objects`, under `debug`. The node paints at `at = drawnAt(obj, pose)`, but `debugSink.recordOrigin` gets `pose.x/y`, so the debug overlay's origin marker sits off the painted node by the quantize step. It is also recorded for a node `culled` skipped. On the hierarchical path, `filteredDrawOne` gets the drawn pose and runs only for nodes that paint. The same overlay answers two ways depending on which path drew it.
- evidence: read
- severity: low

## `nodeShapeEntries`'s doc gives an evaluation order without the built-ins tier
- where: packages/core/src/canvas/NodeShape.ts:276-279 (nodeShapeEntries)
- scenario: the doc says the order is "`'high'` tier first, then `'normal'`, then the rect fallback". `shapes.entries()` returns `evaluationOrder`, which puts the built-ins (`kit:derived`, path, shape, image) between `high` and `normal`, and `kit:path-pose` before the rect fallback (nodeShapeRegistry.ts:171). The module doc at the top of the same file gives the right order. A caller reading this doc expects a `'normal'` painter to beat the built-in path painter, and it does not.
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

<!-- done: 3 findings, files read: 39 -->
