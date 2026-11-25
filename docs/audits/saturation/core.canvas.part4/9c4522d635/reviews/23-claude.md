## `onCommit: 'paint'` paints the first frame outside the frame loop, skipping before-paint and frame subscribers, the visibility gate and throw recovery
- where: packages/core/src/canvas/useCanvasSurface.ts:76 (useRedrawOnCommit, called with `() => paint(lease)` at :59)
- scenario: DrawCanvas / SceneViewCanvas (both `onCommit: 'paint'`) mount. The first commit calls the raw paint directly, not through `useFrameLoop`'s `runPaint`. As a result: `subscribeBeforePaint` listeners don't run before that frame, so whatever they set up for the frame (an animation step) is missing from the first pixels. `subscribeFrame` listeners never hear that the frame landed. `dirtyRef` stays at its initial `true` with no frame requested. The paint runs even when `frame.isVisible()` is false (hidden tab, offscreen), which `redraw` in useFrameLoop deliberately gates for the sync path. A throw escapes the layout effect with no re-arm, where `runPaint` would mark dirty and retry once. The same happens on the first in-place paint after a filling surface's measured resize, since `paintedRef` stays false until this hook's own paint lands. Expected: the in-place paint goes through the loop's `runPaint` (as `paintNow` does), with only the landed boolean surfaced.
- evidence: read
- severity: medium

## A view marker whose id is already live is dropped for good; views with a taken id wait and take over when it frees
- where: packages/core/src/canvas/viewMarkers.ts:56 (createViewMarkerRegistry.registerMarker)
- scenario: marker A with id "m" is live. Marker B registers with id "m" (say, a replacement mounts before the old one's cleanup, or two owners briefly overlap). B is logged and skipped, and its unregister is a no-op. A then unregisters, and no marker "m" is drawn or hit any more, although B is still mounted and asking for it. `viewRegistry.register` handles the same situation for views with a `waiting` queue that promotes the next registration once the id frees. That makes two answers to one question (what happens to a duplicate-id registration while the holder is live). Expected: markers queue the same way views do. Also, the duplicate check reads `props().id` only at registration, so a marker whose thunk later returns another marker's id is never caught.
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
