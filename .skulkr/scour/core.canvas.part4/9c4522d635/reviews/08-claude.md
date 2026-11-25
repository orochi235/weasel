# Findings: core.canvas.part4

## `onCommit: 'paint'` paints the first commit outside the frame loop, skipping its before-paint and frame subscribers and its visibility gate
- where: packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit, line 85)
- scenario: a surface mounted with `onCommit: 'paint'` gets its first frame from `paint(lease)` called directly, not through the loop's `runPaint`. So that first landed frame (a) emits nothing to `subscribeBeforePaint`, so state a subscriber advances before each paint (an animation step, a camera glide) is drawn stale; (b) emits nothing to `subscribeFrame`, so a listener waiting for the first landed frame misses it until something else repaints; (c) ignores `frame.isVisible()` and `aliveRef`, which `redraw` checks because a background tab still commits React updates; (d) has no re-entrancy guard and none of `runPaint`'s throw recovery, so a paint that throws here leaves nothing re-armed. The resize path right next to it uses `loop.paintNow`, which goes through `runPaint`, so one surface answers "paint now in place" two different ways. It should paint through the loop and read back whether the frame landed.
- evidence: read
- severity: medium

## While its host is unresolved, useHostAnchor recomputes on every attribute change anywhere in the document
- where: packages/core/src/canvas/useHostAnchor.ts:96 (useHostAnchor, second effect)
- scenario: `resolveHost` returns null, for example because the host is conditionally absent for a long stretch. The `MutationObserver` watches `document` with `subtree: true, attributes: true`, so every attribute write on the page schedules a `recompute` frame: the cursor sink writing `style.cursor` on hover, a CSS-in-JS class toggle, an animated `style` attribute. A page with any continuous attribute animation then runs the resolver and `setHost`/`setStyle` every frame for as long as the host is missing. Watching `childList` (and attributes only when the selector depends on them) bounds this.
- evidence: read
- severity: low

## useHostAnchor's first paint shows no position, contrary to its doc
- where: packages/core/src/canvas/useHostAnchor.ts:77 (useHostAnchor, first effect)
- scenario: the doc says that until the panel is measured "the first paint lands where an unclamped anchor would". But `style` starts `null`, and the first `recompute` runs in a passive `useEffect`, which React may run after the browser paints. The first painted frame then has `style === null`: the panel either sits unpositioned for a frame or is hidden by the caller, never at the bare corner. A layout effect, or computing the corner during render, would match the doc.
- evidence: read (render ordering is inference)
- severity: low

## A view that both follows another and is nested in a parent skips the parent's layer gate
- where: packages/core/src/canvas/useViewNesting.ts:96 (layerIsPainted), and :86 (drawnLayers)
- scenario: the doc says a view's picks ask whether a layer is "painted here, and in every view this one is nested in or follows". Give a view both `parent` and a live `follows`: `layerIsPainted` returns the followed view's answer and never asks `parentReg()`, so a layer the parent hides stays pickable, marqueeable and select-all-able inside the child. `drawnLayers` likewise takes the followed view's stack in place of the parent's.
- evidence: read
- severity: low

## The client→world conversion returns the client point unchanged when there is no element
- where: packages/core/src/canvas/useClientToWorld.ts:20 (useClientToWorld)
- scenario: before the input element is attached, or in a detached surface whose `inputElement` has not arrived, `clientToWorld(cx, cy)` returns `[cx, cy]`: client pixels presented as world units. The view registry's `surfaceLocal` feeds this through `viewWorldToScreen`, so a hover or resolver query in that window lands at a point derived from client coordinates under the camera, not at the pointer. It should report that no conversion is possible, or use the identity camera with a zero origin, not a mixed-unit answer.
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

<!-- done: 5 findings, files read: 37 -->
