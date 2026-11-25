# Findings: core.canvas.SceneCanvas.part2

## The dispatcher overlay's style (fill, stroke, dash, lineWidth, `roles`) cannot be set by any consumer
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:131 (useSceneCanvasLayers), packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts:30
- scenario: `useDispatcherOverlayLayer` takes `style?: DispatcherOverlayStyle`, and its `roles` doc says it merges a consumer's per-role strokes over the kit's. The CHANGELOG for the removal of `ConnectActionOptions.stroke` says to "use `roles: { connector: … }` on the layer's style" and that "`DispatcherOverlayStyle.roles` is where a consumer restyles one". But its only caller is `useDispatcherOverlayLayer({ dispatcher })`, with no style. No `<SceneCanvas>` prop or `layers` slot feeds one through, and the type is exported only from `import-shims/test-seams`. A consumer who wants to restyle the connector polyline or the marquee/lasso has no way to do it, so the documented migration does not work. The style should be threaded from a prop or slot, or the docs should stop promising it.
- evidence: read (grep shows `dispatcherOverlay` used only at useSceneCanvasLayers.ts:131/153/182; `DispatcherOverlayStyle` exported only via test-seams.ts:84)
- severity: medium

## Departure and preview ghosts paint nodes on layers `layerVisibility` / `layerOrder` hide
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:57 (draw), packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:84 (draw)
- scenario: both layers decide whether a node's own paint shows from `sc.layers.filter((l) => l.visible)`, which is the scene's own flag only. The canvas hides scene layers through the `layerVisibility` and `layerOrder` props by dropping their slot layers (`paintedLayers(document, layerVisibility, layerOrder)`, as `documentLayersOf` in useSceneColorAt.ts shows), and picking gates on the same props (`useViewLayerGate` in useScenePicking). Take `<SceneCanvas layerVisibility={{ notes: false }} poseTransition={{ exit }}>` and remove a node on `notes`: the scene doesn't draw it, but `departure-ghost` fades a visible copy of it out. Likewise, a programmatically selected node on that layer, dragged by its handles or nudged with a preview, ghosts at 0.85 alpha while its layer is hidden. Both should read the canvas's layer gate, not `layer.visible` alone.
- evidence: read
- severity: medium

## A swapped scene is seeded with the first render's `selectionOptions.initial`, not the current one
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` captures `initial` once, at mount. The effect seeds "once per scene" and re-runs when `scene` changes, but it always seeds `first.current`. Suppose a consumer swaps `scene={docB}` together with `selectionOptions={{ initial: ['b1'] }}`. docB is empty of selection, so it gets docA's initial ids instead: a stale or nonexistent selection, and `b1` is never selected. The seed should read the `initial` current at the time the scene changed, through a latest ref.
- evidence: read
- severity: low

## `useViewportWithoutView` warns that navigation does nothing when the viewport only turns navigation off
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:11
- scenario: `unread` counts any key whose value `!== undefined`, so `false` counts too. A canvas without `corePresets.view` that passes `viewport={{ zoom: false, pan: false }}` (or `edgePan: false`) gets told in dev that "wheel, pinch, and the zoom keys do nothing". The consumer configured nothing to be on, so the warning is spurious. `false` values should not count as configuring the view preset.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/SceneCanvas/toolProps.ts
packages/core/src/canvas/SceneCanvas/toolRegistry.ts
packages/core/src/canvas/SceneCanvas/useActionTunings.ts
packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts
packages/core/src/canvas/SceneCanvas/useBakedScene.ts
packages/core/src/canvas/SceneCanvas/useBestHit.ts
packages/core/src/canvas/SceneCanvas/useBuiltinTools.ts
packages/core/src/canvas/SceneCanvas/useCanvasCamera.ts
packages/core/src/canvas/SceneCanvas/useCanvasDispatcher.ts
packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts
packages/core/src/canvas/SceneCanvas/useCanvasTools.ts
packages/core/src/canvas/SceneCanvas/useChromeAffordances.ts
packages/core/src/canvas/SceneCanvas/useContentBounds.ts
packages/core/src/canvas/SceneCanvas/useContributionRoles.ts
packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts
packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts
packages/core/src/canvas/SceneCanvas/useEdgePan.ts
packages/core/src/canvas/SceneCanvas/useHeldModifiers.ts
packages/core/src/canvas/SceneCanvas/useIgnoredProps.ts
packages/core/src/canvas/SceneCanvas/useMagnificationCheck.ts
packages/core/src/canvas/SceneCanvas/useNodeKinds.ts
packages/core/src/canvas/SceneCanvas/usePresetTraits.ts
packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasPathEdit.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasTools.ts
packages/core/src/canvas/SceneCanvas/useSceneChrome.ts
packages/core/src/canvas/SceneCanvas/useSceneColorAt.ts
packages/core/src/canvas/SceneCanvas/useSceneGestureDispatcher.ts
packages/core/src/canvas/SceneCanvas/useScenePickers.ts
packages/core/src/canvas/SceneCanvas/useScenePicking.ts
packages/core/src/canvas/SceneCanvas/useSceneRedrawSources.ts
packages/core/src/canvas/SceneCanvas/useSceneSlotLayers.ts
packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts
packages/core/src/canvas/SceneCanvas/useSceneWorkerSurface.ts
packages/core/src/canvas/SceneCanvas/useSelectionOverlayLayer.ts
packages/core/src/canvas/SceneCanvas/useSurfaceRouting.ts
packages/core/src/canvas/SceneCanvas/useSurfaceViewInputs.ts
packages/core/src/canvas/SceneCanvas/useToolKeybindings.ts
packages/core/src/canvas/SceneCanvas/useViewportActions.ts
packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts
packages/core/src/canvas/SceneCanvas/viewportProp.ts
packages/core/src/canvas/SceneCanvas/workerProps.ts
packages/core/src/canvas/SceneCanvas/worldPointAt.ts

<!-- done: 4 findings, files read: 45 -->
