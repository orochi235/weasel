# core.canvas.part4 findings

## `onCommit: 'paint'` paints the first commit around the frame loop, unlike the resize paint beside it
- where: packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit, line 87)
- scenario: `DrawCanvas` and `SceneViewCanvas` pass `onCommit: 'paint'`. Their first commit calls `paint(lease)` directly, not `loop.paintNow`. So that frame skips everything `useFrameLoop.runPaint` does. `subscribeBeforePaint` listeners don't run before it, and `subscribeFrame` listeners never hear it landed. The `frame.isVisible()` gate is skipped, so a surface mounted in a hidden tab or off screen paints anyway; useFrameLoop's own comment says the sync path must be gated. A paint that throws escapes the layout effect without the loop marking the surface dirty and re-arming a frame. And `dirtyRef` stays `true` after a landed first paint, so the next rAF paints the same frame again. `usePaintOnResize`, two lines above, answers the same "paint this commit in place" question through `loop.paintNow`. Expected: both go through the loop (`paintNow`, or a sync `runPaint` that reports whether it landed).
- evidence: read
- severity: medium

## A frame that throws, then a frame that does not land, leaves no retry for the next throw
- where: packages/core/src/canvas/useFrameLoop.ts:79 (runPaint)
- scenario: `retriedRef` is cleared only when a paint lands. Take this sequence: paint throws (retried = true, re-armed), the retry returns `false` (for example the GL context is lost for now), the context comes back, and the paint throws again. On the second throw `retriedRef` is still `true`, so nothing re-arms. The surface stays dirty and unpainted until something unrelated asks for a redraw. That is the "blanked until the pointer moved" case the catch block exists to prevent. Expected: a frame that runs to the end without throwing (landed or not) clears `retriedRef`.
- evidence: read
- severity: low

## The debug sink starts a frame before the paint knows it has a renderer
- where: packages/core/src/canvas/useCanvasPaint.ts:108 (paint)
- scenario: `beginDebugFrame` runs `sink.beginFrame()` and records every painted layer before `lease.bind`. When there is no renderer (a lost context, or no WebGL2), the paint returns `false`. The debug sink then holds a begun frame, with layer records, that nothing drew and nothing `end`s. It repeats on every retry while the context stays lost, so the debug panel reports frames that never happened. Expected: begin the debug frame after `bind` succeeds.
- evidence: read (inference that the sink shows the begun frame; I did not trace what the debug panel shows)
- severity: low

## A duplicate marker id is dropped for good, while a duplicate view id waits its turn
- where: packages/core/src/canvas/viewMarkers.ts:58 (registerMarker)
- scenario: Mount two `<ViewMarker id="m">`, then unmount the first. The second was skipped at registration and gets a no-op unregister. `ViewMarker` re-registers only when `registry`, `read`, `id` or `target` changes, so the surviving marker never appears. The same registry treats a duplicate `<CanvasView id>` differently: it queues it in `waiting` and promotes it when the holder goes away (viewRegistry.tsx:188). One question, unique ids per surface, gets two answers.
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
