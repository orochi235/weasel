## `actions={null}` mutes the presets' own actions, though the resolver says it leaves them, and only until they re-register
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:105 (applyActionsProp), with packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts:150,207
- scenario: `useSceneStandardActions` runs `useActionSet(standardActions)` (which holds `presetActions(enabled)` and the pool actions tools bind) and `useViewportActions` in effects declared before `useActionsPropResolver` in the same component, so on mount `reg.list()` already holds them and `prop === null` mutes every one of them. The header and `isStale` say `null` mutes "the defaults, not the tools' and presets' own". Later, when `standardActions`' key or a viewport config changes, those effects re-register the actions after the resolver ran, and `isStale` returns false for `null`, so they come back live. Whether a preset's action works under `actions={null}` then depends on whether something re-registered it since mount. One rule should apply both times.
- evidence: read (effect order checked in SceneCanvasInput.tsx: useSceneStandardActions line 139, useToolKeybindings/useContributionRoles line 190)
- severity: medium

## A preset's own tool reported "left out" stays mounted when `defaultTools` or a preset also asks for its id
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:57-66 (resolveToolRegistry)
- scenario: when an own tool's id is also in `args.offered` (which holds the winner of the own tool and the build's tool), the first loop adds it if `defaultTools` names that id or `presetBuiltinTools` has it. The second loop then finds `insertsNothing(tool)` true, warns `tool "<id>" is left out`, and `continue`s without deleting the registry entry. The tool stays choosable and inserts nothing, which is the outcome the check exists to prevent, and the warning says the opposite.
- evidence: read
- severity: low

## `selectionOptions.initial` for a swapped-in scene seeds the first render's ids
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` captures `initial` once per component, but the seed runs once per *scene*. Swap the canvas's live `scene` (which `useBakedScene` allows) along with new `selectionOptions.initial` for it, and the new empty scene is seeded with the old scene's ids. It should get the current `initial`, or nothing when those ids aren't in it.
- evidence: read
- severity: low

## Re-adding a view id through `addView` leaves the old handle drawing the new view
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts:19-25 (useAddedViews.addView)
- scenario: `addView(a)` then `addView(b)` with `b.id === a.id` replaces `a` in the list. The handle returned for `a` still draws through a lookup by id, so it paints `b`, while its `remove` filters by identity and does nothing. A stale handle should be inert in both, or drive `b` in both; here it drives `b` in one and is a no-op in the other.
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
