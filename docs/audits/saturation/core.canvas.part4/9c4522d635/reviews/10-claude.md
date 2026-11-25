## A `<CanvasView>` parent cycle recurses without bound in `drawnLayers` and `layerIsPainted`
- where: packages/core/src/canvas/useViewNesting.ts:92 (drawnLayers), packages/core/src/canvas/useViewNesting.ts:105 (layerIsPainted)
- scenario: two views name each other as `parent` (`a.parent = 'b'`, `b.parent = 'a'`). The registry expects this input: `nestedOrder` places "one caught in a cycle" last, `within` keeps a `seen` set, and `frameIn` guards with `measuring`. But `drawnLayers` calls `parentReg()?.drawnLayers()` and `layerIsPainted` calls `parentReg()?.layerIsPainted(layerId)` with no guard. a → b → a → … until the stack overflows. `drawnLayers` runs on every paint (the viewport layer's `source` in `CanvasView.tsx:88`) and on every press (`useViewPicking`), so the canvas throws each frame. The fix is a reentrancy flag like `measuring`/`following`, which answers `[]` / `false` for a cycle.
- evidence: read
- severity: medium

## A marker skipped for a duplicate id never appears once the holder goes, unlike a view
- where: packages/core/src/canvas/viewMarkers.ts:52 (registerMarker)
- scenario: two `<ViewMarker id="m">` mount. The second is skipped and gets a no-op unregister. When the first unmounts, the second stays mounted but never draws or takes input until something re-registers it (a change to `target` or `id`). `viewRegistry.register` answers the same duplicate-id question differently: it queues the skipped view in `waiting` and promotes it when the holder unregisters. One question gets two answers in the same registry.
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
