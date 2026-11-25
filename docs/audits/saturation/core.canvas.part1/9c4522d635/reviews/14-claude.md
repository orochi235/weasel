## Adapter-resolved derived paths read local poses on a composing adapter that has no `getWorldPose`
- where: packages/core/src/canvas/buildSceneLayer.ts:132 (withAdapterDerivedPaths); packages/core/src/canvas/adapterDerivedPath.ts:34 (adapterDerivedPathOf)
- scenario: `buildSceneLayer` is called with a `HierarchicalAdapter` that has `composePose` (local poses under framing containers) but no `getWorldPose`, no `cfg.toPose`, and no `cfg.derivedPathOf`. `buildSceneTree` paints every node at `compose(parentFrame, local)`, but `withAdapterDerivedPaths` hands the bare adapter to `adapterDerivedPathOf`, whose `poseOf` falls back to `adapter.getPose` — the local pose. An edge whose dependencies sit inside a translated container is drawn from their local coordinates, away from where they are painted. The `toPose` branch of the same function (`toPoseReads`) does compose through `composeWorldPose` when `composePose` exists, so the two branches answer "where is a dependency" differently.
- evidence: read
- severity: medium

## The `objects` path records debug origins and bounds differently from the tree path
- where: packages/core/src/canvas/buildSceneLayer.ts:243 (buildSceneLayer, `cfg.objects` branch)
- scenario: with a debug sink and `cfg.drawnPose` set, the tree path records each node's origin from the pose its painter receives (the drawn pose, via `filteredDrawOne`) and records nothing for a node the cull skipped; the `objects` path records the origin from `pose` (before `drawnAt`) and records bounds and origin for culled nodes too. The debug overlay then marks a quantized node's origin off its painted position, and shows culled nodes, only on the `objects` path.
- evidence: read
- severity: low

## A child id the adapter lists but cannot resolve is pickable, though nothing paints it
- where: packages/core/src/canvas/adapterPickSource.ts:43 (nodeOf / order)
- scenario: `adapter.getChildren(p)` returns an id whose `getNode` answers `undefined` (a stale child list during an edit). `nodeOf` spreads `undefined` and returns a candidate with only `id` and `pose`, which `order()` pushes and the walk can hit; `buildSceneTree.visit` returns on `!node`, so the same id paints nothing. A click can select an invisible, nonexistent node. It should be skipped as `buildSceneTree` skips it.
- evidence: read
- severity: low

## `sceneContentBounds` carries a container's own box through copies the paint walk never draws
- where: packages/core/src/canvas/contentBounds.ts:39 (sceneContentBounds)
- scenario: `buildSceneTree.visitBelow` applies a container's `copiesFromPose` to its children only, and to none when it `consumesChildren` (its children list is `[]`); the container's own paint is drawn once. `sceneContentBounds` carries `boxOf(node.id)` — the container's whole box, its own paint included — through every copy, and does not skip a container that consumes its children. A consuming node with copies, or a group whose border reaches past its members, makes zoom-to-fit and a minimap frame area that nothing is drawn in.
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

<!-- done: 4 findings, files read: 39 -->
