## A full `actions[slot]` descriptor whose `id` differs from its slot registers under `entry.id`, and the resolver then sees itself as stale on every registry change
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:113 (applyActionsProp), :85 (isStale)
- scenario: `actions={{ myZoom: { id: 'otherId', label, invoker } }}` with no action at `myZoom`. `isFull` passes, `reg.register(entry)` registers it at `otherId`, while `live.set('myZoom', entry)` records it under the slot. The file's contract (and the partial path, which warns and keeps the slot) says the slot wins over `entry.id`; here the entry's id wins with no warning. And `isStale` then finds `byId.get('myZoom')` undefined while `mine` is set, so it answers stale on every registry notification forever: each unrelated register/mute/tune releases and re-registers the override (and re-notifies every other subscriber). It should register `{ ...entry, id: slotId }` (warning once on the mismatch, as the merge path does).
- evidence: read
- severity: medium

## `routing={[]}` silently turns off double-click naming, so a double-click on a grouped member names the member, not its outermost group
- where: packages/core/src/canvas/SceneCanvas/useScenePicking.ts:112 (doubleClickNames)
- scenario: a canvas opts out of routing kinds with `routing={[]}`, so `kindOfNode` is undefined and `doubleClickNames` is `undefined`. `useClassifyTarget` (useSceneGestureDispatcher.ts) then falls back to `?? id`, the deepest hit. With routing on, `doubleClickTarget` names the outermost group inside the entered scope (`pressTarget`). The same double-click on a grouped child enters the group on one canvas and targets the leaf on the other, purely because of the kind vocabulary. `kindOf` is only an input to `doubleClickTarget`; the namer should be built with `() => undefined` when there are no kinds.
- evidence: read (doubleClickTarget.ts lines 7-23)
- severity: medium

## `useContentBounds`'s cached committed box is not invalidated when the adapter (and so `committedPoseOf`) changes
- where: packages/core/src/canvas/SceneCanvas/useContentBounds.ts:57 (returned callback)
- scenario: the cache key is scene, `boundsOf`, version and camera. `sceneContentBounds` reads poses through `committedPoseOf`, which closes over `adapter`. A new adapter (a `poseDescriptor` change, a new selection's adapter methods) with the same scene version and the same `boundsOf` identity keeps serving the box computed through the old adapter's world poses until some edit bumps the version. `viewBounds: 'content'`, the zoom fit and the edge-pan `{ past }` limit read the stale rect. Fix: add `committedPoseOf` to `held`'s key.
- evidence: read
- severity: low

## `selectionOptions.initial` seeds a swapped-in scene with the first render's ids
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is never updated, but the layout effect seeds every new `scene`. A consumer that swaps `scene` and passes a matching new `selectionOptions.initial` gets the new, empty scene seeded with the old scene's ids (ids the new scene may not hold, or that name different nodes), never the new initial. It should read the current `initial` when a new scene arrives.
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
