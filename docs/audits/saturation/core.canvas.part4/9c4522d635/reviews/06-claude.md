# Findings: core.canvas.part4

## A view's hit test of its own drawn layers is gated by the surface's layerVisibility/layerOrder, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:66 (hitTestExtrasIn)
- scenario: `useViewPicking` asks `surface.hitTestExtras(..., drawnLayers())`, where `drawnLayers` is `viewPaintedLayers(surface.layers(), view)`, filtered by the view's own `layerVisibility`/`layerOrder` only (sceneLayerPaint.ts:27). `hitTestExtrasIn` then drops each candidate failing `isLayerPainted(layer, gate.layerVisibility, gate.layerOrder)`, where `gate` is the surface's gate. A surface with `layerVisibility={{ grid: false }}` and a `<CanvasView layerVisibility={{ grid: true }}>` paints the grid's affordances in the view, but presses on them inside the view are refused. A layer the surface's `layerOrder` leaves out but the view's includes is refused the same way. With `only` given, the asking view's paint should be the gate, as `only`'s own doc says.
- evidence: read
- severity: medium

## A view's hit test of registered/slot layers receives the surface's chrome-caps predicate, while its paint uses the view's
- where: packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn)
- scenario: `isVisible` is always `gateRef.current.getIsVisible?.()`, the surface's `getIsVisible` prop, even when a `<CanvasView>` asks with its own helpers as `data`. When that view draws, a layer gates chrome through `data.getIsVisible()`, which is the view's caps rule evaluated against the view's own context (`useViewDispatcher` `ruleInputs`). A chrome element hidden in the view by its caps context is still hit-tested by the surface's predicate, so a press lands on an invisible handle. The reverse also happens: a handle the view shows can be refused. The view's `data.getIsVisible()` should be used when a view asks.
- evidence: read (that the caps differ per view is inferred from `ruleInputs` being built from the view's own selection, camera and action)
- severity: medium

## Re-registering a layer object another owner already holds moves it to the top of draw and hit order, and it stays there after that owner releases
- where: packages/core/src/canvas/useExtraLayers.ts:37 (registerLayer)
- scenario: owners A and B register layers L1 then L2. Owner C then registers L1 again. `extrasRef.delete(L1); add(L1)` makes the order L2, L1, so L1 now paints over L2 and gets first refusal on hits. C releases, which leaves `left > 0`, so it returns early and L1 stays above L2. Nothing about A's or B's registration changed, yet a shared layer's order depends on who last took a hold. A second hold should leave the layer where it is, since it stays registered until the last owner lets go.
- evidence: read
- severity: low

## `onCommit: 'paint'` paints the first commit through the raw paint, bypassing the frame loop
- where: packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit)
- scenario: `useRedrawOnCommit` is handed `() => paint(lease)` rather than `loop.paintNow`. On the first commit of `DrawCanvas` or `SceneViewCanvas`, several things go wrong:
  - `subscribeBeforePaint` subscribers don't run before the frame.
  - `subscribeFrame` subscribers aren't told it landed.
  - `dirtyRef` stays true.
  - The visibility gate (`frame.isVisible()`) that the loop's sync path honors is skipped, so a hidden tab still paints.
  - A throw skips the loop's one-retry re-arm.
  The resize path (`usePaintOnResize`) goes through `loop.paintNow`, so "paint this commit in place" is answered two ways in one hook.
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
