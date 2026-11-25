## sceneContentBounds carries a consuming container's operands through its copies when it sits on a hidden layer
- where: packages/core/src/canvas/contentBounds.ts:43 (sceneContentBounds)
- scenario: a node with both `copiesFromPose` and `consumesChildren: true` on a hidden layer. `shown` answers `[]` for it, matching `buildSceneTree`, which gives it no bucket and visits none of its children. The copies loop still computes `own = unionAabb(scene.childrenOf(node.id).flatMap(shown))` because `gates.hidden(node)` is true. It ignores `consumesChildren` and pushes the operands' boxes carried through every copy, so zoom-to-fit and minimap frames take in content that is never drawn. It should use the same `consumesChildren ? [] : …` rule as `shown`.
- evidence: read
- severity: low

## The objects path of the scene slot records a debug origin from the stored pose; the tree path records it from the drawn pose
- where: packages/core/src/canvas/buildSceneLayer.ts:247 (buildSceneLayer, `cfg.objects` branch)
- scenario: a slot with `drawnPose`, such as a scene quantize rule, plus a debug sink. The hierarchical branch's `filteredDrawOne` is handed the drawn pose by `buildSceneTree` and records `recordOrigin` there. The objects branch computes `at = drawnAt(obj, pose)` and paints at `at`, but records the origin from `pose`. The debug overlay then marks the origin away from where the node is painted on one path only, so the same question gets two answers.
- evidence: read
- severity: low

## A LOD rung the painter does not paint falls back to the full paint but drops the label overlay
- where: packages/core/src/canvas/defaultDrawOne.ts:52 (defaultDrawOne)
- scenario: `ctx.rung` is a custom id that the matched painter's `ladder` lacks, or whose rung has no `paint`. Control reaches `painter.paint` (the full representation). `text` is still forced to `undefined` because `rung !== 'full'`, so the node paints in full with its `data.label` missing. Every other full paint keeps the label. The label gate should follow the paint actually chosen, not the requested rung id.
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
