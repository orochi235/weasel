## A view's layer hit-test is gated by the surface's layerVisibility/layerOrder and chrome-caps, not the view's own
- where: packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn), reached from packages/core/src/canvas/useViewPicking.ts:56 (affordanceAt)
- scenario: a `<CanvasView>` asks `surface.hitTestExtras(..., only = drawnLayers())`. `drawnLayers()` is the surface's `layers` filtered by the *view's* `layerVisibility`/`layerOrder` (`viewPaintedLayers`), so it can include a layer the surface hides (e.g. surface `layerVisibility={{ handles: false }}`, a view that does not hide it, or a surface `layerOrder` that omits a layer the view's order keeps). `hitTestExtrasIn` then still drops every layer for which `isLayerPainted(layer, gate.layerVisibility, gate.layerOrder)` fails on the *surface's* gate, so the view paints that layer but presses on it fall through to chrome/scene picking. Likewise the `isVisible` predicate handed to `layer.hitTest` is the surface's `getIsVisible`, while the view's own chrome-caps predicate (`helpers.getIsVisible()`, passed in `data`) is what its paint follows. Should: when `only` is given, the asking view has already decided what is painted; skip the surface gate and use the view's predicate.
- evidence: read (useExtraLayers.ts, useViewNesting.ts drawnLayers, sceneLayerPaint.ts viewPaintedLayers)
- severity: medium

## A marker skipped for a duplicate id never registers when the holder leaves, unlike a view
- where: packages/core/src/canvas/viewMarkers.ts:61 (registerMarker)
- scenario: marker A (`id: "m"`) is live; marker B with the same id mounts and is skipped with an error, its unregister a no-op. A unmounts (e.g. a conditional swap, or a keyed remount whose new instance's effect ran before the old one's cleanup). B is never drawn or hit until it remounts. `viewRegistry.register` answers the same question with a `waiting` queue that promotes the next holder when the id frees; markers answer it the other way.
- evidence: read (viewMarkers.ts, viewRegistry.tsx register)
- severity: low

## The duplicate-marker check reads the id only at registration; a props thunk whose id changes later bypasses it
- where: packages/core/src/canvas/viewMarkers.ts:62 (registerMarker)
- scenario: `props` is read at every draw, so a marker whose `id` changes after registration (props thunk reads live state) can come to share an id with another live marker; both draw and `markerAt` routes `view-marker:<id>` for either, so the affordance id no longer names one marker. Should: compare ids live, or re-check when the id read differs.
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

<!-- done: 3 findings, files read: 37 -->
