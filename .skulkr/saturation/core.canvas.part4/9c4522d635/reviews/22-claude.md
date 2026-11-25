# Findings: core.canvas.part4

## A tool's static `cursor` spec that `resolveCursor` refuses throws out of the canvas render; only the thunk form is guarded
- where: packages/core/src/canvas/useToolCursor.ts:11 (resolveToolsCursor)
- scenario: a tool declares `cursor: { glyph: 'pencil', mark: 'rect' }` (a mark with no slot on that glyph) or an unknown glyph. `resolveCursor` throws (`/no slot/`, `/unknown cursor glyph/`, per packages/cursor/src/resolve.test.ts:61-64). The static branch `if (typeof tool.cursor !== 'function') return resolveCursor(tool.cursor);` sits outside the `try`, so the throw escapes `useToolCursor` during Canvas's render and unmounts the canvas, every time that tool is routed. The same spec returned from a `cursor()` thunk is caught, logged once and shows no cursor. One question gets two answers: the static path should get the same guard.
- evidence: read
- severity: medium

## A duplicate view-marker id is dropped for good, where a duplicate view id waits and takes over when the holder leaves
- where: packages/core/src/canvas/viewMarkers.ts:53 (registerMarker); compare packages/core/src/canvas/viewRegistry.tsx:189 (register)
- scenario: two `ViewMarker`s with id `"m"` mount, A then B. B is logged and skipped, and its unregister is a no-op. A unmounts (it was conditionally rendered, or its key changed), and B, still mounted, never appears: nothing re-registers it. For `<CanvasView>` ids the registry keeps a `waiting` queue and promotes the next same-id registration when the holder unregisters. The two id clashes on the same registry are settled two ways, and the marker way leaves a mounted marker that never draws or takes input.
- evidence: read
- severity: low

## The debug sink starts a frame before the paint knows it can paint, so a lost context or missing WebGL2 records an empty frame
- where: packages/core/src/canvas/useCanvasPaint.ts:105 (paint)
- scenario: with `<Canvas debug>` on, `beginDebugFrame` calls `sink.beginFrame()` and records every layer, and only then does `lease.bind` return `null` (a context lost for now, or no WebGL2). The paint returns `false` without `debugFrame.end`. Each retry while the context is lost resets the sink's frame and lists layers as drawn in a frame that drew nothing, so the debug panel shows a frame that never landed instead of the last one that did. Starting the debug frame after the renderer is bound avoids it.
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
