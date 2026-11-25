# core.canvas.part4 — blind reviewer findings

## Registered/slot layer hit-testing ignores `layerOrder`'s sequence, so the topmost painted layer is not asked first
- where: packages/core/src/canvas/useExtraLayers.ts:61 (hitTestExtrasIn)
- scenario: `<Canvas layers={…} layerOrder={['b', 'a']}>` where the slot stack is `[a, b]`, both with `hitTest`, overlapping. `drawLayers`/`paintedLayers` sequence by `order`, so `a` paints last (on top). `hitTestExtrasIn` walks `[...slotLayersRef.current].reverse()` = `[b, a]` and uses `isLayerPainted` only as a membership filter, so `b` (underneath) answers the press. The doc on `useExtraLayers` promises "the slot stack in paint order: the topmost painted is asked first". Same for a `<CanvasView>`'s `only` list: it arrives in the view's draw order (`viewPaintedLayers` applies the view's `layerOrder`) but is only used as a filter over the surface's order.
- evidence: read (layerVisibility.ts `paintedLayers` reorders by `order`; `isLayerPainted` only tests inclusion)
- severity: medium

## A `<CanvasView>`'s layer hit-test is gated by the surface's `layerVisibility`/`layerOrder`/chrome caps, not the view's
- where: packages/core/src/canvas/useExtraLayers.ts:62-70 (hitTestExtrasIn), called from packages/core/src/canvas/useViewPicking.ts:56
- scenario: `<Canvas layerVisibility={{ overlay: false }}>` hides layer `overlay` on the root; a `<CanvasView>` with no `layerVisibility` (or `{ overlay: true }`) paints it, since `viewPaintedLayers` applies only the view's own visibility to the surface stack. The view's `affordanceAt` passes `drawnLayers()` (which includes `overlay`) as `only`, but `hitTestExtrasIn` still filters by `gateRef.current.layerVisibility`/`layerOrder` — the surface's — so the layer the view shows can never be pressed there. Likewise `isVisible` handed to `layer.hitTest` is the surface's `getIsVisible`, while the same layer's draw in that view reads the view's own `getIsVisible` (its chrome-caps context) through `data`. Paint and hit answer "is this layer/chrome here" two different ways.
- evidence: read
- severity: medium

## A `<CanvasView>`'s `view` dep drops `contentBounds`, `animate`, `decay` and `recenter`, so Fit Content, coasting pans and animated zoom do nothing inside a view
- where: packages/core/src/canvas/useViewOwnDeps.ts:16-21 (viewApi)
- scenario: Inside a `<CanvasView>`, Cmd-Alt-0 routes to `viewport.zoom` `{ kind: 'fit' }`; `viewportZoom.ts:204` breaks out when `view.contentBounds` is absent, so nothing happens, while the same key on the root canvas fits. A hand-tool drag with `inertia` lands dead (no `decay`), and keyboard zoom steps jump rather than animate (no `animate`/`animationTarget`). The view's dep replaces the surface's `view` dep wholesale (`CanvasView.tsx:195`), so none of these fall through from the surface.
- evidence: read (engineDeps.ts ViewApi; viewportZoom.ts fit branch)
- severity: medium

## A resize commit whose in-place paint does not land schedules no frame
- where: packages/core/src/canvas/useCanvasSurface.ts:72-73 (usePaintOnResize) with :84 (useRedrawOnCommit)
- scenario: A commit changes `size`; `usePaintOnResize` calls `paintNow`, which in `useFrameLoop.redraw(true)` runs `runPaint` and returns without `frame.request()`. If the paint returns `false` (detached `paintInto.canvas` not yet set, renderer unavailable this frame), the surface is left dirty with nothing scheduled, and `useRedrawOnCommit` returns early because `resized.current` is true — so its own `if (!painted) requestRedraw()` fallback never runs. The canvas stays blank after the resize until an unrelated request arrives. `useRedrawOnCommit` handles exactly this case for its first-paint path; the resize path does not.
- evidence: read
- severity: low

## A frame with no renderer still opens a debug frame and records its layers
- where: packages/core/src/canvas/useCanvasPaint.ts:107-118 (paint)
- scenario: `<Canvas debug>` whose context is lost (or in a no-WebGL2 environment): `beginDebugFrame` calls `sink.beginFrame()` and `recordLayer` for every painted layer, then `lease.bind` returns null and the paint returns `false` without `end`. The debug sink is left describing a frame that never painted (layer list reset/recorded with no stats), on every retry.
- evidence: read (useDebugSink.ts beginDebugFrame)
- severity: low

## `useRedrawOnShaderSource` recovers program ids by splitting the joined key on `|`
- where: packages/core/src/canvas/useCanvasRenderer.ts:55 (useRedrawOnShaderSource)
- scenario: `shaderKeyOf` joins `h.id` with `|`; a program id containing `|` (e.g. `'blur|v2'`) is split into `'blur'` and `'v2'`, neither registered, so re-registering `'blur|v2'` with new source never repaints. The ids should come from `shaders` itself, keyed by the string only for the effect's dependency.
- evidence: read
- severity: low

## A view whose registration rebuilds hands its id to a duplicate waiting behind it
- where: packages/core/src/canvas/viewRegistry.tsx:186-196 (register / unregister)
- scenario: Views A and B both declare `id="x"`; A holds it, B waits (error logged). Any change to A's registration deps makes `<CanvasView>` A unregister its old record and register a new one: the unregister promotes B immediately, and A's new record then finds B holding `x` and goes to `waiting`. The id flips owners on an unrelated prop change of the original holder, swapping which view paints and takes input.
- evidence: read
- severity: low

## A marker whose `target` changes keeps painting in its old view's stack
- where: packages/core/src/canvas/viewMarkers.ts:60-64 (markerLayers), consumed by packages/core/src/canvas/useLayerStack.ts:79 (useComposedLayers)
- scenario: `registerMarker(props)` says `props` is read at every draw, and `markerAt` does read `target` live. But `markerLayers(null)` filters by `props().target` inside `useComposedLayers`'s memo, which only re-runs on a registry version bump, and a `target` change bumps nothing. A marker whose props move it from the root (`target: null`) to view `"a"` keeps drawing in the root stack (and not in `"a"`) while presses already route as if it were in `"a"`, until some unrelated registration changes the version.
- evidence: read (inference on how the consumer re-reads; not run)
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

<!-- done: 8 findings, files read: 37 -->
