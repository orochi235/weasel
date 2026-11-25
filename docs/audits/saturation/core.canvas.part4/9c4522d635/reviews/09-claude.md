# core.canvas.part4 findings

## A registered/slot layer hit-tested for a `<CanvasView>` is judged by the surface's chrome-caps predicate, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:61 (hitTestExtrasIn), called from packages/core/src/canvas/useViewPicking.ts:51 (affordanceAt)
- scenario: a view's helpers answer `getIsVisible` from `chromeCaps.isVisible(ruleInputs())` with the view's own selection/camera/active action (CanvasView.tsx:163), and its layers draw against that. When the view's press routes through `registry.surface().hitTestExtras(..., helpersRef.current, drawnLayers())`, `hitTestExtrasIn` ignores the data's `getIsVisible` and passes `gate.getIsVisible?.()` — the surface's own predicate, evaluated for the root view's context — to `layer.hitTest`. A chrome rule that hides an element in the view (e.g. scale-gated or action-gated chrome) leaves it grabbable there, and one that shows it in the view but not on the root makes the drawn element unhittable. Paint and hit answer the same visibility question two ways.
- evidence: read (CanvasView.tsx:163, useExtraLayers.ts:61-71)
- severity: medium

## A layer a `<CanvasView>` paints but the surface hides is never hit inside that view
- where: packages/core/src/canvas/useExtraLayers.ts:63-69 (hitTestExtrasIn)
- scenario: the view's `drawnLayers()` come from `viewPaintedLayers(surface.layers(), view)`, which applies only the view's own `layerVisibility`/`layerOrder` (sceneLayerPaint.ts:27-33). A view with `layerVisibility={{ grid: true }}` on a surface whose `layerVisibility` hides `grid` paints the grid, and `useViewPicking` passes it in `only`. `hitTestExtrasIn` then filters again with `isLayerPainted(layer, gate.layerVisibility, gate.layerOrder)` — the surface's settings — so the layer is skipped and its `hitTest` never runs in the view that draws it. The `only` list is already the asking view's painted set; the surface gate should not be reapplied to it.
- evidence: read
- severity: medium

## Files read
packages/core/src/canvas/trimOverrides.ts
packages/core/src/canvas/useCanvasElements.ts
packages/core/src/canvas/useCanvasHandle.ts
packages/core/src/canvas/useCanvasPaint.ts
packages/core/src/canvas/useCanvasRenderer.ts
packages/core/src/canvas/useCanvasSurface.ts
packages/core/src/canvas/useCanvasView.ts
packages/core/src/canvas/useClientToWorld.ts
packages/core/src/canvas/useExtraLayers.ts
packages/core/src/canvas/useFrameLoop.ts
packages/core/src/canvas/useHitObserver.ts
packages/core/src/canvas/useHostAnchor.ts
packages/core/src/canvas/useInFlightBounds.ts
packages/core/src/canvas/useLateContentRedraw.ts
packages/core/src/canvas/useLayerStack.ts
packages/core/src/canvas/usePaintedCursor.ts
packages/core/src/canvas/useRedrawOn.ts
packages/core/src/canvas/useSceneAdapter.ts
packages/core/src/canvas/useSceneLayersKey.ts
packages/core/src/canvas/useSurfaceInput.ts
packages/core/src/canvas/useSurfaceSize.ts
packages/core/src/canvas/useToolCursor.ts
packages/core/src/canvas/useViewAim.ts
packages/core/src/canvas/useViewClientMaps.ts
packages/core/src/canvas/useViewDispatcher.ts
packages/core/src/canvas/useViewHelpers.ts
packages/core/src/canvas/useViewLayerGate.ts
packages/core/src/canvas/useViewNesting.ts
packages/core/src/canvas/useViewOwnDeps.ts
packages/core/src/canvas/useViewPicking.ts
packages/core/src/canvas/useViewRegistrySurface.ts
packages/core/src/canvas/viewInputs.tsx
packages/core/src/canvas/viewMarkers.ts
packages/core/src/canvas/viewRegistry.tsx
packages/core/src/canvas/viewSnap.ts
packages/core/src/canvas/warmRender.ts
packages/core/src/canvas/wrapNodeOutput.ts

<!-- done: 2 findings, files read: 37 -->
