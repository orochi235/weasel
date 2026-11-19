# Findings: core.canvas.SceneCanvas.part2 (round 39)

## Preview ghost paints hidden nodes and nodes on hidden layers while their container is dragged
- where: packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:91 (drawEntry)
- scenario: a group (frame-defining) holds a child with `hidden: true`, or a child whose own `layer` is hidden. Drag the group: `resolvePreviews` brings every child of a frame-carrying container (`carries`), and `drawEntry` calls `drawOne` on each with no visibility check, so the hidden child appears in the ghost for the length of the drag. `buildSceneTree` skips a hidden node, anything under it, and any node on a hidden layer; `useDepartureGhostLayer` at least skips hidden layers ("As the scene paints it: a node on a hidden layer is not drawn"). The preview ghost should paint what the scene paints.
- evidence: read (usePreviewGhostLayer.ts:91-115; resolvePreviews.ts:99-121 has no hidden/visible filter; buildSceneTree.ts:113-115,195)
- severity: medium

## Departure ghost paints a removed `hidden` node (and its subtree)
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:64 (draw)
- scenario: with `poseTransition.exit`, remove a group that carries `hidden: true` (or contains a hidden child). The ghost checks only `shown.has(layer)`, not `r.node.hidden`, so a node the scene never drew fades out visibly on removal. `buildSceneTree` skips a hidden node and everything under it.
- evidence: read (line 64 tests only layer visibility; buildSceneTree.ts:66)
- severity: low

## Worker decides "page builds the scene" from the raw `layers.scene` prop, not the slot after presets
- where: packages/core/src/canvas/SceneCanvas/useSceneWorkerSurface.ts:48 (useSceneWorkerSurface)
- scenario: `<SceneCanvas worker={...} features={[p]}>` where preset `p` supplies `layers.scene` as a pre-built layer (`EnabledPresets['layers']` is `Record<string, CustomLayerEntry>`, and `layersOverPresets` lets it fill the `scene` slot). The page paints the preset's layer (`useSceneCanvasLayers` → `merged.scene`), but `pageBuilt` reads `props.layers?.scene`, which is undefined, so the worker still starts and claims the layer id `'scene'` (`isSceneLayer`), painting the default scene over/instead of the preset's layer. The same slot set by the consumer's own `layers.scene` correctly keeps the worker off. Likewise `sceneSlot` (for `cull`) is the raw prop, not the merged slot. Should read the merged scene slot.
- evidence: read (useSceneWorkerSurface.ts:48-53; mergeLayers.ts:10-16; layerRuns.ts:32)
- severity: low

## A runtime change to `viewport.pan`/`zoom`/`touchZoom` re-registers the action over the `actions` prop's merge, which is not re-applied
- where: packages/core/src/canvas/SceneCanvas/useViewportActions.ts:57 (useViewportActions) with packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts:215
- scenario: `<SceneCanvas viewport={{ zoom: { axis } }} actions={{ 'viewport.zoom': { defaultBinding: [...] } }}>` (a partial override, which `useActionsPropResolver` registers as a merged descriptor on top of the stack). Change `axis` at runtime: `zoomKey` changes, the viewport effect releases and re-registers `viewport.zoom`, pushing a fresh descriptor on top of the merged one. The resolver's effect is keyed on `[reg, actions, rev]` (rev = standard action ids), none of which changed, so it does not re-run and the consumer's override is silently buried until something else changes. `viewportProp.ts:17-19` promises the `actions` prop "runs after this". (Mute is stack-independent, so `null` survives; partial and full replacements don't.) The resolver should be keyed on the viewport keys too.
- evidence: read (useViewportActions.ts:53-76; useActionsPropResolver.ts:74-82; registry.ts:42-54 "newest live")
- severity: low

## Content bounds are cached on `scene.getVersion()`, which pose overrides and scroll offsets do not bump
- where: packages/core/src/canvas/SceneCanvas/useContentBounds.ts:44 (useContentBounds' returned reader)
- scenario: an animator (or `poseTransition`) moves a node through `scene.overrides` — e.g. plays a shape out to x = 5000 and holds it there — or a container's `scroll` offset moves its children. `boundsOf` / `committedPoseOf` read `effectivePose`, which takes the override (effectivePose.ts:310-313), but `poseOverrideTypes.ts:9` says writing one "does not bump `Scene.getVersion()`", and `useSceneRedrawSources.ts:10-12` says a scroll does not either. The cache key (`scene`, `boundsOf`, `version`) is unchanged, so the held box keeps the pre-animation/pre-scroll extent: zoom-to-fit (the `view` dep's `contentBounds`), `viewBounds: 'content'` clamping (useCanvasCamera) and edge-pan's `limit: { past }` all frame where the content was, not where it is drawn. The key should also cover the override and scroll sources (or subscribe to them).
- evidence: read (useContentBounds.ts:43-53; effectivePose.ts:305-315; poseOverrideTypes.ts:9)
- severity: medium

## `colorAt` samples scene layers `layerOrder` leaves out, and in the slot's order rather than the painted one
- where: packages/core/src/canvas/SceneCanvas/useSceneColorAt.ts:16 (documentLayersOf)
- scenario: `<SceneCanvas layerOrder={['scene:a', 'grid', ...]}>` omitting `scene:b` (or reordering `scene:a` above `scene:b`). Paint goes through `paintedLayers(..., layerOrder)`, which drops any layer missing from a supplied order and composites in that order; picking honours the same via `useViewLayerGate(layerVisibility, layerOrder, …)`. `documentLayersOf` filters only by `layerVisibility` and annotation layers, and `useSceneColorAt` is not even handed `layerOrder` (SceneCanvasInput.tsx:150-153), so the eyedropper (`colorAt` dep) composites `scene:b`, which is not on screen, and stacks the rest in slot order: it reports a colour the user cannot see. Should run the slot's layers through the same `paintedLayers`/`paintedSceneLayers` with `layerOrder`.
- evidence: read (useSceneColorAt.ts:16-25,27-46; sceneLayerPaint.ts:26-32, 67-80; useScenePickers.ts:84-88 comment)
- severity: low

## `useBakedScene` hands a later `SerializedScene` prop through as if it were a live `Scene`
- where: packages/core/src/canvas/SceneCanvas/useBakedScene.ts:17 (useBakedScene)
- scenario: mount `<SceneCanvas scene={liveScene}>`, then re-render with `scene={json}` (e.g. a "load file" handler that sets state to the parsed JSON without changing `key`). The `useState` initializer ran once with the live scene, so `bakedScene` is `null`, and the hook returns `sceneInput as Scene` — the plain JSON object — and the first `scene.subscribe` / `scene.get` throws. The doc says later prop changes are ignored (use `key`), but only JSON→anything is ignored; live→JSON is not ignored, it crashes. It should bake on that transition, or keep the last live scene and warn.
- evidence: read (useBakedScene.ts:17-20)
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

<!-- done: 7 findings, files read: 45 -->
