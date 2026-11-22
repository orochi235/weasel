# Audit round 66 — core.canvas.part1

## Orphaned custom layers are emitted in map order, ignoring anchors between them
- where: packages/core/src/canvas/layerOrder.ts:121 (composeOrderedLayers, orphan fallback loop)
- scenario: `layers = { b: { layer: B, after: 'a' }, a: { layer: A, before: 'missing' } }`. Neither is reached by the slot walk, so both fall to the orphan loop. That loop goes through `allCustomKeys` in insertion order and pushes each `.layer` directly, without `emitChild`. B is pushed before A, so B paints *under* A even though it declared `after: 'a'`. A dangling anchor is supposed to move only the dangling entry to the tail. Customs chained off it should keep their places relative to it, which emitting each orphan through `emitChild` (anchoring its dependents around it) would do.
- evidence: read
- severity: low

## toPoseReads' parent fallback reads `parentId`, a field kit nodes don't carry
- where: packages/core/src/canvas/buildSceneLayer.ts:131-132 (toPoseReads)
- scenario: A consumer adapter passed to `buildSceneLayer` with `composePose` and a `toPose`, but no `getParent`, whose nodes are kit-shaped (`Node.parent`, as nodeGates, copiesAbove, scenePickReads and sceneAdapter all read it). `getParent` falls back to `(node as { parentId? }).parentId`, which is undefined, so every node reads as a root. `composeWorldPose` then returns each dependency's local pose as its world pose, and a derived edge whose dependencies sit inside a translated container is drawn at their local coordinates, away from the nodes it connects. It should fall back to `node.parent`, as every other parent lookup in canvas/ does.
- evidence: read
- severity: low

## drawnBoundsOf counts a member on a hidden layer, which the render walk doesn't paint
- where: packages/core/src/canvas/drawnBounds.ts:84-87 (inkExtentsOf, member filter)
- scenario: A group's member sits on a scene layer with `hidden: true`. `buildSceneTree` gives that layer no bucket, so the member's own paint never draws (its children on visible layers still do). `inkExtentsOf` filters members by `hidesSubtree` only, so the hidden-layer member's drawn box still widens the group's box. Selection chrome, alignment and the `inkBoxes` dep then frame ink that isn't on screen. The filter's own comment says "a hidden one shows nothing". `contentBounds.ts` handles the same case by descending into such a node's children instead of taking its box.
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
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/mountedCanvases.ts

<!-- done: 3 findings, files read: 50 -->
