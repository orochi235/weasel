# Audit round 71 — core.canvas.SceneCanvas.part2

## A partial `actions` entry merged on a sibling canvas's merge keeps that sibling's fields after it unmounts
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:99-133 (applyActionsProp / isStale)
- scenario: two canvases share one actions registry (the case the header names: "a sibling sharing the registry"). Canvas A passes `actions={{ move: { invoker: a } }}`, canvas B mounts later with `actions={{ move: { label: 'B' } }}`. B's merge is built from `reg.list()`'s current `move`, which is A's merged descriptor, so B's live `move` is `{ ...A merged, label: 'B' }` carrying A's `invoker`. A unmounts and pops its own entry from beneath B's; B's `isStale` sees its own descriptor still live and does not re-apply, so canvas B keeps running A's `invoker` for as long as it is mounted. It should re-merge onto the descriptor A's removal uncovers (the default).
- evidence: read
- severity: medium

## A pick asked for another view takes the surface's id frames and LOD rungs, since `askedOwnView` never reads `viewId`
- where: packages/core/src/canvas/SceneCanvas/useScenePickers.ts:353-358 (askedOwnView), used at :305 and :326; fed by `askedBy` at :234-236
- scenario: `geometry.picking: 'pixels'` (or any canvas with LOD state) and a press routed to a `<CanvasView>` (`pickEveryIn(world, 'inset')`). `askedBy` builds `{ ...surfaceCamera, viewId: 'inset' }` with no gates, so `askedOwnView` returns true: the pick reads the surface's id frame at the surface-camera screen position of a world point produced by the inset's camera, and takes the surface's LOD rungs, though the comment at :325 says "another view's pick reads its own drawing". A node the inset draws at a different rung, or one the surface draws elsewhere or under other chrome, is hit or missed by the surface's paint, not the view's. A pick naming a `viewId` other than null should count as not the surface's own.
- evidence: read
- severity: low

## Hover in a declared view drops the view's camera, so parallax layers hover as if they moved with the camera, and hover and press disagree there
- where: packages/core/src/canvas/SceneCanvas/useSceneChrome.ts:48-50 (useSceneHover); compare useScenePickers.ts:234-236 (askedBy)
- scenario: a `<CanvasView>` showing a scene with a parallax layer. Hover over a node on that layer: `useSceneHover` hands the picker `{ scale, layerIsPainted, viewId }` with no `x`/`y`, so `cameraOf` returns null and the walk treats every layer as moving with the camera (PickView doc: "left out, every layer is taken to move with the camera"). The node is hovered where it would sit with no parallax, not where the view draws it. A press in the same view goes through `askedBy`, which passes the surface's `x`/`y`, so it resolves the plane against a third camera. The two paths answer "what is under the pointer in this view" differently; both should hand the view's own camera (`target.view`'s `x`/`y` is right there at :42).
- evidence: read
- severity: low

## `viewport={{ inertia }}` without the `view` preset warns that it does nothing, though hand-tool inertia still works
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:9-10
- scenario: `<SceneCanvas defaultTools={['hand']} viewport={{ inertia: true }}>` with no `view` preset. `useBuiltinTools` hands `inertia` to `useHandTool` whatever the presets (useBuiltinTools.ts:23), the tool brings `viewport.dragPan` through `builtinToolActions` (presets/toolDriven.ts:7, pool in useSceneCanvasTools.ts:48), and `useSceneStandardActions` publishes the decay loop on the `view` dep unconditionally (:134-152). So the drag pans with momentum, yet the dev warning fires saying `viewport` configures a preset that is not on and that navigation does nothing. Only `recenter` is exempted; `inertia` should be too.
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
