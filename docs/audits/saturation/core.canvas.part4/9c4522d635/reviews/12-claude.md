# core.canvas.part4 findings

## A view marker skipped for a duplicate id never takes the id when the holder goes, unlike a duplicate view
- where: packages/core/src/canvas/viewMarkers.ts:47 (registerMarker)
- scenario: two `<ViewMarker id="m">` mount; the second logs an error and is skipped with a no-op unregister. The first unmounts: the second stays unregistered (not drawn, not hit) until its `id`/`target` change makes it re-register. `viewRegistry.register` answers the same situation the other way, queueing the skipped view in `waiting` and promoting it when the holder unregisters (viewRegistry.tsx:186-197). One decision, two answers.
- evidence: read (ViewMarker.tsx:24 registers only on registry/read/id/target change)
- severity: medium

## Re-registering a layer another owner already holds moves it to the top of the extras, and it stays there after that owner lets go
- where: packages/core/src/canvas/useExtraLayers.ts:37 (registerLayer)
- scenario: owner A registers layer L, owner B registers M, owner C registers L again. `delete`+`add` moves L above M in draw and hit order. C releases: the hold count drops to 1 and L is left above M, although the only remaining holder registered it before M. Draw/hit order then depends on a released owner's history.
- evidence: read
- severity: low

## A shader id containing `|` breaks the source-change redraw
- where: packages/core/src/canvas/useCanvasRenderer.ts:54 (useRedrawOnShaderSource)
- scenario: `shaderKeyOf` joins handle ids with `|` (canvasRenderer.ts:129-130) and this hook splits the key back on `|`. A handle with id `fx|blur` becomes the ids `fx` and `blur`, `getProgramSource` answers neither, and re-registering `fx|blur` with new source never requests a redraw. It should keep the ids list (or `shaders.map(h => h.id)`) rather than round-tripping through the key.
- evidence: read
- severity: low

## A resize commit whose in-place paint fails schedules no retry
- where: packages/core/src/canvas/useCanvasSurface.ts:72 (usePaintOnResize), with useFrameLoop.ts:122 (redraw)
- scenario: a commit changes `size`; `paintNow` runs `runPaint` in place, and the paint returns `false` (no canvas element yet, renderer not bound). `redraw(true)` returns after `runPaint` without `frame.request()`, and `useRedrawOnCommit` returns early because `resized` is set, so the surface stays dirty with nothing scheduled until an unrelated request. `useRedrawOnCommit`'s own first paint handles the same failure with a `requestRedraw()` fallback; the resize path does not.
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

<!-- done: 4 findings, files read: 37 -->
