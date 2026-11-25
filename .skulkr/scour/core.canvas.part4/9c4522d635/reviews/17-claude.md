## `onCommit: 'paint'` paints the first commit around the frame loop, while a resize paints through it
- where: packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit)
- scenario: a surface with `onCommit: 'paint'` gets its first commit painted by `() => paint(lease)`, the raw paint, not `loop.paintNow` (which `usePaintOnResize` two lines above uses). So that first frame skips everything `runPaint` does: `subscribeBeforePaint` subscribers are not run before it (a subscriber that advances state for the frame shows its pre-frame state on the first paint), `subscribeFrame` subscribers never hear the first landed paint, the `frame.isVisible()` gate is bypassed (a surface mounted in a background tab or off screen paints anyway, which the loop's own comment says the sync path must not), the dirty flag stays set, and a throw gets no re-armed retry. Should go through `loop.paintNow` (with a way to read whether it landed), as the resize path does — one pathway for "paint in place".
- evidence: read
- severity: medium

## A marker skipped for a duplicate id never takes the id when the holder goes, unlike a view
- where: packages/core/src/canvas/viewMarkers.ts:57 (createViewMarkerRegistry → registerMarker)
- scenario: marker B registers with id "m" while marker A holds "m" (e.g. two components briefly overlap during a re-key, or A unmounts later than B mounts). B is logged and dropped, its unregister is a no-op; when A unregisters, B is still not drawn and `markerAt` never finds it, though B is mounted and its id is now free. The view registry answers the same question the other way (`viewRegistry.tsx` `register` queues the duplicate in `waiting` and promotes it when the holder frees). Same decision, two answers; markers should queue too.
- evidence: read
- severity: low

## Registering an already-held layer again moves it to the top of the extras stack
- where: packages/core/src/canvas/useExtraLayers.ts:38 (useExtraLayers → registerLayer)
- scenario: owner 1 registers layer L, then layer M is registered, then owner 2 registers the same L (the hold count exists for exactly this). `delete`+`add` moves L above M, so draw and hit order change though L was already on the canvas; when owner 2 releases, L stays above M. A second hold of a layer already present should only bump the count and keep its place (round 21 in `docs/unruled.md` ruled the same reordering a defect for diagram's helpers).
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
