# Findings: core.canvas.part3 (round 40)

## useHostAnchor watches only the host it found when the effect ran, so a late-mounting host is never followed
- where: packages/core/src/canvas/useHostAnchor.ts:77 (useHostAnchor effect)
- scenario: `resolveHost` returns null at mount (host mounts after the panel, or is found by selector before it exists). The effect runs once: `recompute()` sets style null, `watchResize([panel, null])` and no `watchElementMove`. When the host later appears, nothing re-runs the effect (deps are `recompute, raf, panel, resolve`), so the panel stays unplaced (`style: null`) until an unrelated window scroll/resize happens. Even then, the host's own resizes and moves are never watched. Same if the selector starts resolving to a different element: watchers stay on the old one. The JSDoc promises "a host that mounts late or is found by selector works the same as one held in a ref".
- evidence: read
- severity: medium

## `claimsAbove` lets the surface's slot layers occlude every `<CanvasView>`, though views paint above them
- where: packages/core/src/canvas/useViewRegistrySurface.ts:48 (claimsAbove), via packages/core/src/canvas/useExtraLayers.ts:47 (hitTestExtrasIn)
- scenario: `SurfaceHandle.claimsAbove` is the view resolver's `occluded` test, documented as "whether a registered layer claims a point… Registered layers paint over every view". It calls `hitTestExtrasIn` with no `only`, and since 77bfacf5dc that walks the `layers`-map slot layers too, not just registered ones. `useComposedLayers` paints the slots *under* the root markers and the views. So a canvas whose slot stack has a hit-testable layer (a custom `layers` entry with `hitTest`, e.g. CurveLab's anchor-handle slot) and a `<CanvasView>` over the same canvas pixels: a press inside the view where that slot layer hits at the surface's own camera is resolved to the surface, not the view. The press hits a layer the view has painted over, at the wrong camera. It should test only `extrasRef` (the layers above the views), or pass `only` as the registered set.
- evidence: read (`git log -L` on useExtraLayers.ts shows the slot concat added in 77bfacf5dc; claimsAbove unchanged)
- severity: medium

## The headless scene view culls a `dependsOn` node by its stored pose box, while painting it along its derived path
- where: packages/core/src/canvas/sceneViewRender.ts:182 (buildSceneViewCommands, `culled`)
- scenario: `cull: true` on `renderSceneToCanvas`/`<SceneViewCanvas>`/a minimap, and a `kit:path` node with `dependsOn` (a connector) whose path is derived from its sources' poses. The painter goes through `withDerivedPaths`, so `drawOne` gets `ctx.derivedPath` and draws the connector where its sources are. The cull's `paintBounds` chain gets `withOverridePathBounds` only, which supplies `ctx.derivedPath` just for a pose override's `path`, never the `dependsOn` derivation. `PATH_PAINTER.bounds` then falls back to `poseBoxBounds(pose)` (pathPainter.ts:52). With both sources moved on screen and the connector's stored pose box off screen, `paintMissesView` reports a miss and `buildSceneTree` never calls the painter, so a visible connector is missing from the frame. This is the case 0bb71da607 fixed for override paths, still open for derived ones. The bounds should get `derivedPathAt(nodeAsShown(…))`, the same lookup the walk's `derivedPathOf` uses.
- evidence: read (I did not confirm that nothing keeps a `dependsOn` node's stored pose on its derived path; if something does, this cannot happen)
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

<!-- done: 3 findings, files read: 46 -->
