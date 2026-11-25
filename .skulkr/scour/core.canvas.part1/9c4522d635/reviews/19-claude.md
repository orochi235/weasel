# Findings: core.canvas.part1

## Adapter-resolved derived paths are rotated twice under a turned, composing container
- where: packages/core/src/canvas/buildSceneLayer.ts:114 (withAdapterDerivedPaths)
- scenario: a bare `HierarchicalAdapter` with `composePose` (no scene-aware `derivedPathOf`) holds a derived edge inside a rotated container. `adapterDerivedPathOf` builds the path from the deps' world (composed) poses, so the path is already where it shows. `buildSceneTree` then hands `drawOne` the composed pose, and `filteredDrawOne` wraps the output through `wrapNodeOutput(cmds, pose, …)`, which turns it by that pose's rotation. That rotation includes the container's turn, so the edge is turned a second time and misses the nodes it connects. The scene path (`withDerivedPaths` in derivedPath.ts) fixes exactly this with `withoutInheritedFrame`; the adapter path has no such correction, so the two paths answer one question in two ways.
- evidence: read (derivedPath.ts `withoutInheritedFrame` doc explains the double turn; wrapNodeOutput wraps by pose rotation)
- severity: medium

## A composing adapter without `getWorldPose` reads derived-path deps at their local poses when the slot has no `toPose`
- where: packages/core/src/canvas/buildSceneLayer.ts:114 (withAdapterDerivedPaths)
- scenario: with `cfg.toPose` set, deriving reads go through `toPoseReads`, which builds `getWorldPose` from `composePose`, `getParent` and `childFrame`, so deps are read where they are drawn. With `cfg.toPose` unset, the raw adapter goes to `adapterDerivedPathOf`, which falls back to `adapter.getPose` (local) whenever the adapter has `composePose` but no `getWorldPose`. `HierarchicalAdapter` declares no `getWorldPose`. The edge between two children of a translated container is then drawn at their local coordinates, offset from where `buildSceneTree` paints those nodes (it composes them). Whether an edge meets its nodes depends on whether a `toPose` was passed. Fix: always route through `toPoseReads(adapter, toPose)`.
- evidence: read
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

<!-- done: 2 findings, files read: 39 -->
