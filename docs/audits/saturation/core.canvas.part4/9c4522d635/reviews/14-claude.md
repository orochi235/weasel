# Findings: core.canvas.part4

## A duplicate-id view takes the id away from its holder whenever the holder's registration is rebuilt
- where: packages/core/src/canvas/viewRegistry.tsx:175 (ViewRegistryProvider, `register` unregister closure)
- scenario: View A holds id "main" and view B, also "main", is queued in `waiting`. `CanvasView` replaces its registration every time a prop the registration reads changes (CanvasView.tsx:208–211, an effect on `[registry, registration]`). So any prop change on A runs A's unregister, which promotes B from `waiting` straight into the entries. A's new registration then finds B holding the id and is queued itself. The id flips to whichever view did not re-render last, and input and paint jump between the two views on ordinary prop changes. The error claims the second view is "skipped until that view goes away", but here A never went away.
- evidence: read
- severity: medium

## A marker skipped for a duplicate id never appears, even after the holder goes away
- where: packages/core/src/canvas/viewMarkers.ts:56 (createViewMarkerRegistry, `registerMarker`)
- scenario: Two `<ViewMarker id="m">` mount, or a key change mounts the new one before the old one's cleanup runs. The second is skipped and gets a no-op unregister. When the first unmounts, nothing promotes the second, so no marker "m" is drawn until the survivor happens to re-register (its effect depends on id/target only). The view registry answers the same question differently: it queues a duplicate in `waiting` and hands it the id when the holder frees it. Two pathways for one decision.
- evidence: read
- severity: low

## `onCommit: 'paint'` paints the first frame around the frame loop: no before/after subscribers, no visibility gate, no retry on a throw
- where: packages/core/src/canvas/useCanvasSurface.ts:84 (useRedrawOnCommit)
- scenario: `DrawCanvas` and `SceneViewCanvas` pass `onCommit: 'paint'`. Their first commit calls the raw `paint(lease)` instead of the loop's `paintNow`, which skips `runPaint`:
  - `subscribeBeforePaint` subscribers don't run before the frame, and `subscribeFrame` subscribers never hear that it landed.
  - It paints even in a hidden tab, which `redraw`'s `frame.isVisible()` gate exists to stop.
  - A throw escapes uncaught and does not re-arm the frame.
  - The dirty flag is left set.

  The resize path in the same file (`usePaintOnResize`) goes through `loop.paintNow`. The two in-place paints take different routes.
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
