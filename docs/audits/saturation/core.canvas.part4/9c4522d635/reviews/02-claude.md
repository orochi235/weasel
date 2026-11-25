## A view's hit-test of the layers it paints is gated by the surface's layerVisibility, which the view's paint ignores
- where: packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn), reached from packages/core/src/canvas/useViewPicking.ts:56 (affordanceAt)
- scenario: `<Canvas layerVisibility={{ grid: false }}>` with a `<CanvasView>` that sets no `layerVisibility` (or `{ grid: true }`). The view's `drawnLayers()` is `viewPaintedLayers(surface.layers(), view)`, gated only by the view's own `layerVisibility` (`sceneLayerPaint.ts:32`), so the view paints the grid layer. A press in the view calls `surface.hitTestExtras(..., only = drawnLayers())`, but `hitTestExtrasIn` also skips every layer failing `isLayerPainted(layer, gate.layerVisibility, gate.layerOrder)` with the *surface's* gate, so the grid's `hitTest` is never asked in that view though it is drawn there. The reverse also holds for `layerOrder`. Paint and pick answer "is this layer shown here" two different ways; with `only` given, the view's list should be the whole gate.
- evidence: read
- severity: medium

## Root view markers are memoized on the registry version, but a marker's `target` is read live, so a marker retargeted to or from the root paints in the wrong frame
- where: packages/core/src/canvas/useLayerStack.ts:78 (useComposedLayers), packages/core/src/canvas/viewMarkers.ts:61 (markerLayers)
- scenario: `registerMarker(props)` reads `props()` at every draw, and `markerAt` reads `props().target` live. `useComposedLayers` snapshots `viewRegistry.markerLayers(null)` inside a `useMemo` keyed on `viewRegistryVersion`, which only moves on register/unregister. A marker whose props thunk starts returning `target: null` (it was `'detail'`) is not in the root stack until something else bumps the version: `markerAt(null, …)` grabs it at the root while nothing paints it there; one moved from `null` to a view stays painted at the root (and is also painted in the view, whose `CanvasView.tsx:88` reads `markerLayers(id)` live). Either filter by target at draw time or bump the version when a marker's target changes.
- evidence: read
- severity: low

## useHostAnchor never recomputes when the caller's `resolveHost` starts naming another element while a host is resolved
- where: packages/core/src/canvas/useHostAnchor.ts:41 (resolve / recompute), :80 (watch effect)
- scenario: `resolveHost` is held through `useLatest`, so a re-render passing a resolver for a different element (`() => refB.current` in place of `() => refA.current`, or a selector whose match changes) does not change `recompute`'s identity and runs nothing. With a host resolved, the only triggers are scroll, window resize, and resize/move of the *old* host and the panel; the MutationObserver that would notice is only installed while the host is null. The panel stays pinned to the old host until an unrelated scroll, though the hook's comment says a selector naming another element "moves the watch". Same when the resolved host is detached from the DOM without resizing first.
- evidence: read
- severity: low

## A nested view whose parent is missing derives its camera against the surface, but its rect collapses to nothing
- where: packages/core/src/canvas/useViewNesting.ts:47 (derivedAt) vs :37 (rectAt)
- scenario: `<CanvasView parent="p">` while `p` is unregistered (unmounted, or still waiting behind a duplicate id), or in a parent cycle where `measuring` is set. `frameIn` returns `null`; `rectAt` answers `NO_RECT`, but `derivedAt` falls back to `derive(outer, dims)`, the surface's frame. A derived `view`/`aim` function is then handed the surface's camera and size, which it was not written for, and the aim's `aim()`/`reportWrite` computes against a zero rect. The two helpers answer "no parent frame" two ways; the derived one should get no frame as well (or both should fall back to the surface).
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
