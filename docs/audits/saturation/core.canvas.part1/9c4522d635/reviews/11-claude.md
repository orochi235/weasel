## A ladder rung with no `paint` of its own paints the full painter but loses the node's `data.label`
- where: packages/core/src/canvas/defaultDrawOne.ts:46 (defaultDrawOne)
- scenario: a painter declares `ladder.rungs = [{ id: 'mid', fromPx: 40 }]` (no `paint`; `Rung.paint` says "Absent: the painter's own `paint`"). When LOD picks `'mid'`, the code falls through to `painter.paint(...)`, which is the same output as `'full'`. But the label check `rung !== undefined && rung !== 'full'` still suppresses the `data.label` overlay. A labeled node that looks identical at `'mid'` and `'full'` loses its label as it crosses the threshold. The label should be dropped only where the rung draws something of its own (`box`, `none`, or a rung with `paint`).
- evidence: read (packages/core/src/canvas/lod/ladder.ts:19-20 for the Rung contract)
- severity: low

## The scene slot's two paint paths record debug bounds and origins for different sets of nodes
- where: packages/core/src/canvas/buildSceneLayer.ts:241 (buildSceneLayer, `cfg.objects` path) vs :197 (filteredDrawOne)
- scenario: with `debug` on and `cull: true`, an object outside the view is skipped by `culled?.(obj, at)` on the `cfg.objects` path, yet its bounds and origin are still recorded in the debug sink, because the `if (debugSink)` block sits outside the `drawOne && !culled` branch. On the hierarchical path the record is made inside `filteredDrawOne`, which the tree walk never calls for a culled node, so the same node is not recorded. The debug overlay therefore shows boxes for culled nodes on one path and not on the other. The question "does the overlay show what was painted" gets two different answers.
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
