## `defaultActiveTool` under a `ToolsApi` takeover still seeds the internal `useTools`, which throws when the id is only the takeover's
- where: packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:128 (useCanvasTools)
- scenario: `<SceneCanvas tools={myToolsApi} defaultActiveTool="brush">`, where `brush` is in the consumer's registry and not in the canvas's own. `useIgnoredProps` warns that `defaultActiveTool` is ignored under a takeover, but `useCanvasTools` still passes `active: defaultActiveTool` to the internal `useTools` unconditionally, and routing's `useTools` throws `useTools: active "brush" not in registry` (packages/routing/src/tools/useTools.ts:179) on mount. The prop should be dropped when `takeover` is set, falling back to `'select'`-if-registered.
- evidence: read
- severity: high

## A full `actions` entry whose `id` differs from its slot key is registered under its own id, and the resolver then reapplies it on every registry change
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:112 (applyActionsProp), :87 (isStale)
- scenario: `actions={{ 'my.slot': { id: 'my.other', label, invoker } }}` with nothing registered at `my.slot`. The new-entry path calls `reg.register(entry)` as-is, so the action lands at `my.other`, which contradicts the header's "slot wins over entry.id". The mismatch warning fires only on the merge path, so nothing warns. Then `live.set('my.slot', entry)`, and `isStale` finds `byId.get('my.slot')` undefined ≠ `entry`, so every later registry notification releases and re-registers it. It should register `{ ...entry, id: slotId }` and warn, as the merge path does.
- evidence: read
- severity: medium

## A pre-built `selectionOverlay` layer loses its `before` / `after` anchor
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:174 (useSceneCanvasLayers); useSelectionOverlayLayer.ts:46
- scenario: `layers={{ selectionOverlay: { layer: myLayer, after: 'grid' } }}`. `builtLayersOf(merged)` keeps the entry with its anchor, but the map then overwrites it with `{ layer: selectionOverlayLayer }`, where `useSelectionOverlayLayer` returned only `slot.layer`. The anchor is dropped, and the layer sits at the default selection-overlay position. The sibling `pathEditingOverlay` slot passes a custom entry through whole (line 180), so the two slots answer the same question in two different ways.
- evidence: read
- severity: low

## `selectionOptions.initial` is captured once for the component's life, so a swapped-in scene is seeded with the first render's ids
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: The canvas mounts with `scene={a}` and `selectionOptions={{ initial: ['n1'] }}`. The consumer then swaps to `scene={b}` with `initial: ['m1']`. `first` is a `useRef(initial)` that is never updated, so the effect seeds scene `b` (empty selection) with `['n1']`, an id from the old scene, rather than `['m1']`. The doc says it seeds "once per scene". It should read the latest `initial` when a new scene arrives.
- evidence: read
- severity: low

## `viewport={{ pan: false }}` without the view preset warns that navigation "does nothing"
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:10 (useViewportWithoutView)
- scenario: A canvas without `corePresets.view` that passes `viewport={{ pan: false, zoom: false }}`, which is consistent: it asks for less navigation, and none is what it gets. The check counts any key whose value is not `undefined`, so `false` triggers the "wheel, pinch, and the zoom keys do nothing" warning. Only values that turn something on (not `false`) should count.
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

<!-- done: 5 findings, files read: 45 -->
