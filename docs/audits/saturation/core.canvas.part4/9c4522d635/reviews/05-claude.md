# Findings: core.canvas.part4

## A marker skipped for a duplicate id never appears, where a view skipped the same way takes over when the holder leaves
- where: packages/core/src/canvas/viewMarkers.ts:52 (registerMarker), compare packages/core/src/canvas/viewRegistry.tsx:189 (register)
- scenario: two `<ViewMarker id="m">` mount on one surface; the second logs an error and gets a no-op unregister. The first then unmounts. The second marker is still mounted, but its props were never put in `markers`, so it never draws and never answers `markerAt` until it remounts. `register` answers the same question the other way: a view skipped for a held id goes into `waiting` and takes the id when the holder unregisters. One question gets two answers on one registry.
- evidence: read
- severity: low

## The shader-source watcher splits program ids on `|`, so an id containing one never triggers a repaint
- where: packages/core/src/canvas/useCanvasRenderer.ts:55 (useRedrawOnShaderSource)
- scenario: a custom program has id `fx|glow`. `shaderKeyOf` joins ids with `|` (canvasRenderer.ts:130), and the effect splits the key back into `['fx', 'glow']`. `getProgramSource` returns undefined for both fragments every time, so when the program is re-registered with new source, `changed` stays false and the surface never repaints with the new shader. It should watch the handles' ids themselves rather than a joined string that is split again.
- evidence: read (inference that ids may contain `|`: nothing in `shaderKeyOf` or the registry rules it out)
- severity: low

## A resize with `viewBounds` paints one frame in place with the old, unclamped view before the reclamp
- where: packages/core/src/canvas/useCanvasSurface.ts:68 (usePaintOnResize), packages/core/src/canvas/useCanvasView.ts:178 (useReclampOnResize)
- scenario: `<Canvas viewBounds>` is resized smaller from a ResizeObserver callback. `useCanvasSurface`'s layout effect (called early in Canvas.tsx:77) paints the new size in place with `viewRef` unchanged. `useReclampOnResize`'s layout effect runs later (Canvas.tsx:149), writes the clamped view, and only `requestRedraw`s, which goes to the next animation frame. Per `CanvasSurfaceOptions.size`'s own doc, the in-place paint is the frame the browser shows, so one frame shows the visible rect outside `viewBounds` before it snaps back. The resize paint should come after the reclamp, or the reclamp should paint in place.
- evidence: read (effect order from Canvas.tsx; the one visible frame is inference)
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
