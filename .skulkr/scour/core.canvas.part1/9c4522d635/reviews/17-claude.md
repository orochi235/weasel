# Findings: core.canvas.part1

## An adapter-resolved derived path is turned twice under a rotated container, where the scene path undoes the inherited turn
- where: packages/core/src/canvas/buildSceneLayer.ts:133 (withAdapterDerivedPaths)
- scenario: `buildSceneLayer` given an adapter with `composePose` (no `derivedPathOf`), and a derived edge (`dependsOn`) inside a rotated group. `adapterDerivedPathOf` resolves the path from the dependencies' world poses, so it is already where it shows; the walk then hands the painter the edge's composed world pose, which carries the container's rotation, and `wrapNodeOutput` turns the output by `poseFrameOf(pose)` again. The edge is drawn rotated about the container's turn a second time and no longer meets its endpoints. The scene path (`withDerivedPaths` in `derivedPath.ts`) handles exactly this with `withoutInheritedFrame`; the adapter path answers the same question without it.
- evidence: read
- severity: medium

## The scene slot records a node's debug origin at its drawn pose on one path and its stored pose on the other
- where: packages/core/src/canvas/buildSceneLayer.ts:255 (buildSceneLayer, `cfg.objects` branch)
- scenario: a scene with a `drawnPose` (quantize rule) and `debug` on. The hierarchical walk calls `filteredDrawOne` with the drawn pose and records `recordOrigin` from it; the `objects` branch computes `at = drawnAt(obj, pose)` and paints at `at`, but records the origin from `pose`. The debug overlay marks the origin off the painted node by the quantize offset in one path only.
- evidence: read
- severity: low

## A copy-drawing node that consumes its children, on a hidden layer, still frames its operands' copies
- where: packages/core/src/canvas/contentBounds.ts:41 (sceneContentBounds)
- scenario: a node with `copiesFromPose` and `consumesChildren: true` on a hidden layer. `shown` returns `[]` for it (its operands are drawn only as its result, which is not drawn), but the copies loop takes `own = unionAabb(scene.childrenOf(node.id).flatMap(shown))` without the `consumesChildren` check, so its operands' boxes, carried through every copy, enter the content bounds. Zoom-to-fit and a minimap frame content that is not painted.
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
