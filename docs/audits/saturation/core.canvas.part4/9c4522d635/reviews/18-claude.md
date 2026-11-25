# core.canvas.part4 findings

## A registered layer hit-tested inside a `<CanvasView>` is handed the surface's chrome-caps predicate, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:64 (hitTestExtrasIn), called from packages/core/src/canvas/useViewPicking.ts:51 (affordanceAt)
- scenario: a view whose chrome caps hide an element a registered layer draws (its `helpers.getIsVisible()` returns `false` for that id) asks `registry.surface().hitTestExtras(..., helpersRef.current, drawnLayers())`. `hitTestExtrasIn` ignores the view's helpers for visibility and passes `gateRef.current.getIsVisible?.() ?? alwaysVisible` — the surface's predicate — as the layer's `isVisible`. The layer then returns a hit from chrome the view does not draw, so a press on empty space in the view grabs invisible chrome. It should pass the asking view's predicate (e.g. `data.getIsVisible()` when the caller supplies view helpers).
- evidence: read (RenderLayer.hitTest contract at packages/core/src/core/layers/render.ts:151-154: "must not return a hit from any chrome element whose id reports false")
- severity: medium

## Inside a view, registered layers are also gated by the surface's `layerVisibility`/`layerOrder`, so a layer the view paints but the surface hides can never be hit there
- where: packages/core/src/canvas/useExtraLayers.ts:68 (hitTestExtrasIn)
- scenario: `useViewPicking` passes `only = drawnLayers()`, which `viewPaintedLayers` already filtered with the view's own `layerVisibility ?? {}` (packages/core/src/canvas/sceneLayerPaint.ts:31-32), replacing the surface's. `hitTestExtrasIn` then applies `isLayerPainted(layer, surfaceVisibility, surfaceOrder)` on top. A surface with `layerVisibility={{ hud: false }}` and a view with none paints `hud` in the view, yet presses on it in the view skip it and fall through to the chrome/scene beneath. The two passes answer "is this layer painted here" differently; with `only` supplied, the surface gate should not apply.
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
