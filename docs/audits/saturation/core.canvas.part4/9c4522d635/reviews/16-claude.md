## A `parent` cycle between two views recurses without bound in `drawnLayers` and `layerIsPainted`
- where: packages/core/src/canvas/useViewNesting.ts:85 (drawnLayers), :96 (layerIsPainted)
- scenario: `<CanvasView id="a" parent="b">` and `<CanvasView id="b" parent="a">`. The registry expects this case: `nestedOrder` in viewRegistry.tsx places "one caught in a cycle" last, and `frameIn` guards against it with `measuring`. But `drawnLayers` calls `parentReg()?.drawnLayers()`, which is b's `drawnLayers` calling a's again, with no guard. `layerIsPainted` does the same through `parentReg()?.layerIsPainted(layerId)`. CanvasView.tsx:88 reads `drawnLayers()` at draw time, and picks and hover read `layerIsPainted`, so a frame or a press overflows the stack where it should find no layers (or `false`), as `frameIn` already does. `follows` has this guard (`following`); `parent` does not.
- evidence: read (the call chain was read; that a draw reaches `source` for a view whose rect resolves empty is inference, but `layerIsPainted` is reached from picking whatever the rect)
- severity: medium

## A marker skipped for a duplicate id never takes the id once its holder leaves, unlike a view
- where: packages/core/src/canvas/viewMarkers.ts:51 (registerMarker)
- scenario: two `<ViewMarker id="m">` mount. The second logs an error and gets a no-op unregister. When the first unmounts, the second stays unregistered for good, so it draws nothing until it remounts. `ViewRegistry.register` (viewRegistry.tsx:198) handles the same duplicate case differently: it queues the skipped view in `waiting` and promotes it when the id frees. So one decision has two answers.
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
