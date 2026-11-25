I read all 46 files and found 3 defects. Writing `.skulk/out/findings.md` was refused, so, as the brief allows, the whole document is below.

# Findings: core.canvas.part3

## A slot layer painted under the views still counts as "painted above" them, so it takes presses inside a view's rect
- where: packages/core/src/canvas/useViewRegistrySurface.ts:48-52 (useViewRegistrySurface / claimsAbove)
- scenario: a `<SceneCanvas>` gets a `layers` custom entry that has `hitTest`, such as a diagram lane, edge-end or waypoint layer from `composeAffordanceLayer`. It also hosts a `<CanvasView>` whose rect covers part of the canvas. `claimsAbove` calls `hitTestExtrasIn` with no `only`. `hitTestExtrasIn` (useExtraLayers.ts:47) asks the registered layers first, then every slot layer. But `useComposedLayers` paints the slot stack under the views. So when a press inside the view's rect lands where the root camera puts that slot layer's affordance, the resolver's `occluded` (viewResolver.ts:108) says yes. The press goes to the root surface, even though the view painted over those pixels and the user pressed what the view shows. `SurfaceHandle.claimsAbove` says "Whether a registered layer claims…", and only registered layers paint over every view. It should pass `only` = the registered layers (`extrasRef`). It also passes `helpersRef.current`, which may be null, as the layer's `data`.
- evidence: read
- severity: medium

## useHostAnchor never watches a host that resolves after its effect ran, so a host that mounts late leaves the panel unplaced
- where: packages/core/src/canvas/useHostAnchor.ts:71-88 (useHostAnchor effect)
- scenario: `resolveHost` returns null on the first effect run, because the host mounts later or is found by selector after a sibling renders. `recompute` sets `style` to null. The effect's deps (`recompute, raf, panel, resolve`) don't change when the host appears. So no `watchResize` or `watchElementMove` is ever attached to it, and nothing recomputes until some unrelated window scroll or resize. The panel stays at `style: null`. The docblock promises "a host that mounts late or is found by selector works the same as one held in a ref". In the same way, if the host is replaced by a different element, the old element keeps the watchers and the new one moves without being followed.
- evidence: read
- severity: medium

## registerLayer keys a Set by layer object, so one owner's dispose removes a layer another owner still holds
- where: packages/core/src/canvas/useExtraLayers.ts:33-40 (useExtraLayers / registerLayer)
- scenario: two callers register the same `RenderLayer` object, for example one module-scope layer shared by two contributions, or one caller registering it twice. The Set holds it once. The first disposer's `delete` unregisters it for both, so the second owner's layer stops painting and hit-testing while its registration is still live. Registering it again also doesn't move it to the top of hit order, which the "last registered is hit first" rule promises. It should count registrations, or key each one by a token.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/sceneViewRender.ts
packages/core/src/canvas/selectRange.ts
packages/core/src/canvas/selectionChrome.ts
packages/core/src/canvas/shownNodes.ts
packages/core/src/canvas/slopsDebugLayer.ts
packages/core/src/canvas/surfaceContribution.ts
packages/core/src/canvas/testing/stubCanvasContext.ts
packages/core/src/canvas/timelineFrames.ts
packages/core/src/canvas/topmostOf.ts
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

Git commands were refused, so I couldn't check the last week's history, and I skipped the root `CLAUDE.md` and `docs/unruled.md` (the root `CLAUDE.md` was already in my context).

<!-- done: 3 findings, files read: 46 -->