## A preset's own tool that "is left out" for inserting nothing stays mounted when `defaultTools` or `tools.<id>=true` also names it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:53-69 (resolveToolRegistry)
- scenario: `offered` holds a preset's own tool id (the winner from `usePresetBuilds`), so the first loop over `ids` mounts it when `defaultTools` lists the id or the patch says `true`. The second loop then finds `insertsNothing(tool, insertBuilds)` true, warns `tool "<id>" is left out: no insert factory on this canvas builds the kind it inserts` and `continue`s. It never deletes the entry the first loop wrote, so the tool stays in the registry and can be picked. The warning says the tool was dropped, but the user can still pick a tool that inserts nothing. The second loop should delete the id from the registry, or the first loop should skip own-tool ids.
- evidence: read
- severity: medium

## `defaultActiveTool` doc says it is ignored under any consumer `tools` prop, but only the takeover form ignores it
- where: packages/core/src/canvas/SceneCanvas/toolProps.ts:55-59 (SceneCanvasToolProps.defaultActiveTool)
- scenario: `<SceneCanvas tools={{ myTool }} defaultActiveTool="myTool">`. The doc says "Ignored when the consumer supplies their own `tools` prop", but `useCanvasTools` passes `defaultActiveTool` to `useTools` whenever `tools` is the patch form, and `ignoredProps` only lists it under a `ToolsApi` takeover. A reader who trusts the doc thinks the patch form loses the prop, when it is actually honored.
- evidence: read
- severity: low

## Selection seeding of a swapped-in scene uses the first render's `selectionOptions.initial`
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53-61 (useSeed)
- scenario: `first = useRef(initial)` is never updated. When the canvas swaps to a new live scene with a new `selectionOptions.initial`, the effect seeds the new scene ("once per scene") with the ids from the first render. Those ids belong to the old scene, and the current `initial` is ignored.
- evidence: read
- severity: low

## A press routed to a view id the registry does not hold loses lod-aware and pixel picking, though it uses the surface's camera
- where: packages/core/src/canvas/SceneCanvas/useScenePickers.ts:288-291 (askedBy) with :365-370 (askedOwnView)
- scenario: For an unknown `viewId`, `askedBy` falls back to `{ ...surfaceCamera, viewId }` ("the surface's camera"). Because `viewId != null`, `askedOwnView` returns false, so `geometry.picking: 'pixels'` falls back to the shape walk and the canvas's `lod` rungs are not used. A click can then resolve against a different LOD shape from the one painted. That pick also forwards a `viewId` to a caller's `pickEvery` for a view that does not exist.
- evidence: read
- severity: low

## `selectTool` keys set to `undefined` overwrite the canvas's `extendClickLocked` default
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasPathEdit.ts:35-40 (selectToolWithDefaults)
- scenario: `selectTool={{ extendClickLocked: someFlag ? fn : undefined }}` spreads `undefined` over the default `() => pathEditState.getEditingId() !== ''`. Shift-click then stops deferring to the anchor selection while a path is anchor-edited, where an omitted key keeps the default.
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
