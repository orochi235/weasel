# Findings: core.canvas.part4

## `onCommit: 'paint'` paints the first commit outside the frame loop, while a resize paint goes through it
- where: packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit)
- scenario: `DrawCanvas` / `SceneViewCanvas` (both `onCommit: 'paint'`) mount. `useRedrawOnCommit` is handed `() => paint(lease)`, the raw paint, not `loop.paintNow`. So the first in-place frame skips everything `runPaint` does: `subscribeBeforePaint` listeners are not run before it, `subscribeFrame` listeners never hear it landed, the dirty flag stays `true` (the next rAF paints the same frame a second time), the `paintingRef` re-entrancy guard is not set, and the `frame.isVisible()` gate is bypassed, so a surface mounted in a hidden tab or offscreen still paints in the commit. `usePaintOnResize`, two lines up, answers the same question ("paint this commit in place") through `loop.paintNow`, which does all of those. Expected: one path, through the loop, with the boolean result taken from it.
- evidence: read
- severity: medium

## A duplicate-id view takes over the id whenever the holding view re-registers
- where: packages/core/src/canvas/viewRegistry.tsx:207 (ViewRegistryProvider → register / its unregister)
- scenario: views A and B share id "v"; A registered first, B waits. A's effect re-runs (a new registration object on a prop change): its cleanup unregisters A, which promotes B from `waiting` into the entries, then A's setup finds B holding "v" and goes to `waiting`. Each re-registration of whichever view holds the id flips which view is live, so the painted and routed view alternates with unrelated prop changes. Expected: the view that held the id keeps it across its own re-registration (or promotion deferred until the holder is really gone).
- evidence: read (inferred from React's cleanup-before-setup ordering)
- severity: low

## A marker skipped for a duplicate id never takes the id when the holder goes away, unlike a view
- where: packages/core/src/canvas/viewMarkers.ts:52 (createViewMarkerRegistry → registerMarker)
- scenario: two `<ViewMarker id="m">` mount; the second logs an error and is dropped with a no-op unregister. When the first unmounts, the second stays unregistered for its whole lifetime (its effect only re-runs on `registry`/`id`/`target` change), so no marker "m" draws although one is mounted. The view registry answers the same situation the other way: a duplicate view waits and takes the id when it frees (`waiting` in viewRegistry.tsx). One decision, two answers.
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
