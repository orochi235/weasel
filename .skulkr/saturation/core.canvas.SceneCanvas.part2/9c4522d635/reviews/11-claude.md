## `defaultActiveTool` under a `ToolsApi` takeover throws instead of being ignored
- where: packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:121 (useCanvasTools)
- scenario: `<SceneCanvas tools={myToolsApi} defaultActiveTool="myTool">`, where `myTool` lives only in the consumer's registry. `toolProps.ts` documents `defaultActiveTool` as "Ignored when the consumer supplies their own `tools` prop", and `useIgnoredProps` warns that it is ignored. But `internal = useTools({ active: defaultActiveTool ?? …, registry })` still runs under the takeover with the canvas's own registry (patch is null there). `useTools` (packages/routing/src/tools/useTools.ts:179) throws `useTools: active "myTool" not in registry` on mount, so the canvas crashes. It should pass `null` or `'select'` for `active` when `takeover` is set.
- evidence: read
- severity: high

## resolveToolRegistry repeats its patch warnings on every render
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:73 and :78 (resolveToolRegistry)
- scenario: `useBuiltinTools` calls `resolveToolRegistry` on every render, with no memo. A `tools={{ nope: true }}` patch, or a patch tool for an id that `defaultTools` also names, logs `tools.nope=true names no tool…` or `tools prop overrides bundled…` once per render of the canvas. That is on every dispatcher pump, because the overlay and ghost layers force rerenders. Only the unbuildable-tool warning is deduplicated (by `warnedUnbuildable`). These should warn once per patch entry the same way.
- evidence: read
- severity: low

## The viewport-without-view warning fires for options that only disable something
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:11 (useViewportWithoutView)
- scenario: a canvas without `corePresets.view` passes `viewport={{ pan: false }}` or `{ edgePan: false }`. Its `value !== undefined` test counts `false`, so dev warns that "wheel, pinch, and the zoom keys do nothing", even though the consumer configured nothing that needs the preset. `false` (and `zoom: false` / `touchZoom: false`) should be left out of the test, like `undefined`.
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

<!-- done: 3 findings, files read: 45 -->
