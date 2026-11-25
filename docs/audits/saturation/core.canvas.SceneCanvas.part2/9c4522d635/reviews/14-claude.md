## A full `actions` entry whose `id` differs from its slot key registers under the entry's id, not the slot's, and re-registers on every registry change
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:113 (applyActionsProp)
- scenario: `actions={{ 'my.action': { id: 'other', label: 'X', invoker } }}` with no existing `my.action`. The `!existing` branch calls `reg.register(entry)` as-is, so the action lands at `other`, and the mismatch warning (which only runs on the merge path) never fires. The module's contract says the slot wins over `entry.id`, and the merge path does strip `id`. Also, `live.set('my.action', entry)` makes `isStale` see `byId.get('my.action') !== mine` on every later registry notification, so the resolver releases and re-registers the action on each one. It should register `{ ...entry, id: slotId }` and warn about the mismatch, as the merge path does.
- evidence: read
- severity: medium

## The preview ghost paints a node whose hidden container is still in the scene; the departure ghost gates the same case out
- where: packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:88 (drawEntry / roots loop)
- scenario: an in-flight preview (for example a move or nudge) of a node whose ancestor group is hidden. `drawEntry` checks only `hidesSubtree(entry.node)`, so the root's ghost is drawn even though the scene paints nothing for that subtree. `useDepartureGhostLayer` answers the same question differently: its `shownUnder` drops a ghost when any ancestor still in the scene hides its subtree. The preview should apply the same ancestor gate to each root.
- evidence: read
- severity: low

## `selectionOptions.initial` seeds each new scene with the value from the first render
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is never updated, but seeding runs again for each new `scene`. If a consumer swaps to a new scene and passes a new `selectionOptions.initial` for it, the new scene is seeded with the first scene's ids: wrong ids, or ids the new scene doesn't hold. The doc says "once per scene", so the seed should be the `initial` current when that scene first mounts.
- evidence: read
- severity: low

## The viewport-without-view warning fires for options that turn navigation off
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:10 (useViewportWithoutView)
- scenario: `viewport={{ pan: false }}` or `{ edgePan: false }` on a canvas without the view preset. Any key other than `recenter`/`inertia` with a value other than `undefined` counts as configuring navigation, so `false` (which configures nothing) warns that "wheel, pinch, and the zoom keys do nothing". It should skip `false` values.
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
