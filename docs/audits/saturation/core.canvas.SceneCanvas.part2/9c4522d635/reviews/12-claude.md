## A full `actions` entry whose `id` differs from its slot key registers under the entry's id, and is re-registered on every registry change
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:107 (applyActionsProp, `!existing` branch)
- scenario: `actions={{ foo: { id: 'bar', label, invoker } }}` with no `foo` registered → `reg.register(entry)` registers it as `bar`, not `foo`, and the mismatch warning never fires (it is only on the merge path). The module doc says the slot wins over `entry.id`. `live` then records `foo → entry`, so `isStale` sees `byId.get('foo') === undefined !== entry` on every later registry notification and releases and registers `bar` again each time.
- evidence: read
- severity: medium

## A preset's own tool that inserts nothing is kept when `defaultTools` also names it, despite the "left out" warning
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:52 (resolveToolRegistry)
- scenario: a preset's `build` offers its own tool `rect` (so `offered` holds `rect`), and the consumer also passes `defaultTools={['rect']}`, on a canvas with no insert factory for `rect`'s kind. The first loop iterates `Object.keys(offered)` and `setOwn`s `rect` because `defaultTools` asks for it, and it never checks `insertBuilds`. The second loop then warns "tool "rect" is left out" and `continue`s, but nothing removes the first loop's entry. A tool that can insert nothing stays choosable, and the warning says the opposite.
- evidence: read
- severity: low

## `selectionOptions.initial` seeds a swapped-in scene with the ids from the first render
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is never updated, but the effect seeds once per scene. Swap `scene` for a new live scene and pass a new `selectionOptions.initial` for it → the new empty scene is seeded with the original scene's ids, which it may not hold, and the new `initial` is ignored. It should seed with the `initial` current at the swap.
- evidence: read
- severity: low

## `defaultActiveTool` doc says any `tools` prop makes it ignored, but only the takeover form does
- where: packages/core/src/canvas/SceneCanvas/toolProps.ts:55 (SceneCanvasToolProps.defaultActiveTool)
- scenario: `tools={{ pen: true }}` (patch form) with `defaultActiveTool="pen"` → `useCanvasTools` passes `defaultActiveTool` to `useTools`, so it is honored. The doc says "Ignored when the consumer supplies their own `tools` prop", and `useIgnoredProps` only warns under a `ToolsApi`. A reader following the doc drops a prop that works.
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
