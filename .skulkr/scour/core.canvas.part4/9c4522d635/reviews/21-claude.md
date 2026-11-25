# core.canvas.part4 findings

## A view's hit-test of registered/slot layers uses the surface's chrome-caps predicate, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn), called from packages/core/src/canvas/useViewPicking.ts:56 (affordanceAt)
- scenario: a `<CanvasView>` whose chrome-caps rules (evaluated against its own `ViewRuleInputs`) hide a chrome id the surface's rules show. `useViewPicking` passes the view's helpers as `data`, and the frame and layer list are the view's, but `hitTestExtrasIn` always passes `gateRef.current.getIsVisible?.()` (the surface's predicate) as the layer's `isVisible`. The layer draws in the view under `data.getIsVisible()` (the view's), so an element hidden in that view still takes the press there; the reverse also holds (shown in the view, hidden on the surface → not hittable). The predicate should come from the asking view, e.g. `data.getIsVisible()` when the caller supplies view helpers.
- evidence: read (the predicate source); that layers draw by `data.getIsVisible()` is inferred from `CanvasViewHelpers.getIsVisible`'s doc
- severity: medium

## `onCommit: 'paint'` first-commit paint bypasses the frame loop and its visibility gate
- where: packages/core/src/canvas/useCanvasSurface.ts:59 (useCanvasSurface → useRedrawOnCommit, `() => paint(lease)`)
- scenario: `DrawCanvas` and `SceneViewCanvas` mount in a hidden tab (or offscreen with `target` set). `useRedrawOnCommit` calls the raw `paint(lease)` rather than going through `useFrameLoop`, so the paint runs although `redraw` says the sync path must be gated by `frame.isVisible()`. It also skips `subscribeBeforePaint` emission, the `paintingRef` re-entrancy guard, the dirty flag and the throw-retry. A first paint that throws propagates out of the layout effect with no rearm. `usePaintOnResize` in the same hook answers the same "paint in place" question through `loop.paintNow`, so the two paths disagree. The fix is one in-place paint on the loop that reports whether it landed.
- evidence: read
- severity: low

## `useViewNesting.layerIsPainted` skips the parent check for a view that follows another
- where: packages/core/src/canvas/useViewNesting.ts:96 (layerIsPainted)
- scenario: a view with both `parent: 'P'` and `follows` naming a live view F, where P hides scene layer L and F shows it. `ofFollowed` returns F's answer (`true`) and returns before `parentReg()` is asked, so the view's picks, marquees and select-alls reach L's nodes even though they are not painted in P. That contradicts the function's own doc ("painted here, and in every view this one is nested in or follows"). The check should AND the followed answer with the parent's.
- evidence: read (doc vs code); whether `parent` with `follows` is a combination callers use is not checked
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
