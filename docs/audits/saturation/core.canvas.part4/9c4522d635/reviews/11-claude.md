## A view marker skipped for a duplicate id never appears once the holder leaves, where a duplicate view id does
- where: packages/core/src/canvas/viewMarkers.ts:59 (createViewMarkerRegistry → registerMarker)
- scenario: marker A with id "m" mounts, then marker B with id "m" mounts and is skipped with an error (its unregister is a no-op). A then unmounts. B's effect does not re-run (its deps `registry, read, id, target` are unchanged), so B is never registered and never drawn or grabbable until it remounts. `viewRegistry.register` (viewRegistry.tsx:178) answers the same question the other way: a skipped duplicate waits in `waiting` and takes the id when the holder frees it. One decision, answered two ways.
- evidence: read (ViewMarker.tsx:24 registers only in an effect keyed on registry/read/id/target)
- severity: medium

## A shader program id containing `|` breaks the re-registration watch
- where: packages/core/src/canvas/useCanvasRenderer.ts:55 (useRedrawOnShaderSource)
- scenario: `registerProgram('fx|glow', …)` passed in `shaders`. `shaderKeyOf` joins ids with `|` (canvasRenderer.ts:130) and this hook splits the key back on `|`, giving `['fx', 'glow']`. Neither names the registered program, so `getProgramSource` reads null for both and re-registering `fx|glow` with new source never repaints. It should watch the handles' ids as given, not a split of the joined key. Program ids are free strings; nothing forbids `|`.
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
