## A view's hit-test of registered layers is gated by the surface's layer visibility, order and chrome-caps, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn), called from packages/core/src/canvas/useViewPicking.ts:51 (affordanceAt)
- scenario: `<SceneCanvas layerVisibility={{ grid: false }}>` with a `<CanvasView>` that sets no `layerVisibility`. The view paints `viewPaintedLayers(surface.layers(), view)` (useViewNesting.ts `drawnLayers`), which judges the unfiltered surface stack by the view's own visibility, so the grid paints in the view. useViewPicking passes those `drawnLayers()` as `only`, but `hitTestExtrasIn` still requires `isLayerPainted(layer, surfaceVisibility, surfaceOrder)`, so the grid's `hitTest` is never asked inside the view. Clicks on a layer the view draws fall through. The reverse also happens: a view whose `layerOrder` differs from the surface's is judged by the surface's order. The `isVisible` handed to `layer.hitTest` is likewise the surface's `getIsVisible`, never the asking view's chrome-caps predicate (`helpers.getIsVisible`), so per-view chrome rules don't reach hit-testing. When `only` is given it has already been gated for the asking view, and the surface gate should not apply on top of it.
- evidence: read (useExtraLayers.ts:63-77, useViewNesting.ts drawnLayers, sceneLayerPaint.ts viewPaintedLayers)
- severity: medium

## A resize commit whose in-place paint fails schedules no retry, and suppresses the commit path's retry
- where: packages/core/src/canvas/useCanvasSurface.ts:70 (usePaintOnResize), with useFrameLoop.ts:118 (redraw) and useCanvasSurface.ts:84 (useRedrawOnCommit)
- scenario: a surface with `size` and `onCommit: 'redraw' | 'paint'` commits a new size, and the paint returns `false` (no renderer bound yet, a lease whose bind returns null, a detached target not yet present). `paintNow` → `redraw(true)` → `runPaint` sets `dirtyRef = true` and returns without `frame.request()`. Then `useRedrawOnCommit` returns early because `resized.current` is true, so its own failure handling (`if (!paintedRef.current) requestRedraw()`) never runs. The cleared buffer stays blank until some unrelated request arrives. `useRedrawOnCommit` handles a failed in-place paint by requesting a frame, and the resize path does not, so the same question gets two answers. The fix is to request a frame when the resize paint does not land, or to have `redraw`'s in-place branch fall back to `frame.request()` when `runPaint` reports nothing landed.
- evidence: read
- severity: low

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
