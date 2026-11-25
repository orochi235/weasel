# Findings: core.canvas.SceneCanvas.part2 (round 71)

## doubleClickNames freezes the entered group at memo time, so a double-click after entering a group names the wrong node
- where: packages/core/src/canvas/SceneCanvas/useScenePicking.ts:105-110 (useScenePicking, `doubleClickNames`)
- scenario: `scope: enteredGroup.get()` is evaluated when the memo runs, and the memo is keyed on `[scene, kindOfNode, enteredGroup]`. `enteredGroup` is the stable per-scene store from `useEnteredGroup` (createPart), whose identity does not change on `enter`/`leave`. So: user double-clicks a group to enter it (scope still `null` in the closure), then double-clicks a member inside it → `doubleClickTarget` resolves against `scope: null` and names the outermost group again instead of the member under the entered group (and the reverse after leaving). Should read `enteredGroup.get()` at call time.
- evidence: read (doubleClickTarget.ts:9 takes `scope: string | null` as a value; enteredGroup.ts:100 `useEnteredGroup = createPart(createEnteredGroup)`)
- severity: medium

## A press routed to a `<CanvasView>` picks through the surface's layer gate, id frames and LOD, while hover in the same view uses the view's own gate
- where: packages/core/src/canvas/SceneCanvas/useScenePickers.ts:234-238,249-250 (askedBy / pickEveryIn / pickBestIn), with askedOwnView at :353-358
- scenario: a `<CanvasView>` whose registration carries its own `layerIsPainted` (a view that hides a layer the surface shows). Hover there (`useSceneChrome.ts:45-49`) asks the picker with `{ scale, layerIsPainted: reg.layerIsPainted, viewId }`, so a node on the hidden layer is not hovered. A press there goes through `pickEveryIn(world, viewId)` (the select tool's `everyIn`, presetBuild.ts:99), where `askedBy` builds `{ ...surfaceCamera, viewId }` with no gate, so `walk` falls back to the surface's `layerIsPainted` and the press selects the node the view does not draw. The same missing gate makes `askedOwnView` (which never looks at `viewId`) answer true for that press, so under `geometry.picking: 'pixels'` it reads the surface's id frame, and in every mode it reads the surface's `lod` rungs, though the comment at :325 says another view's pick reads its own drawing. Hover and press name different nodes in one view.
- evidence: read
- severity: medium

## `tools={{ id: true }}` for a preset's own tool warns that the canvas offers no such tool, while mounting it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:72-76 (resolveToolRegistry)
- scenario: a preset brings its own tool `X` (`presetOwnTools(enabled)`) that no preset `build` re-offers. `offered` is only `builtins` plus `args.offered`, so with `tools={{ X: true }}` the second loop mounts `X` (line 68) and the patch loop then warns in dev "tools.X=true names no tool this canvas offers; ignoring", which is false: the tool is there. The check should also accept the ids `presetOwnTools` mounted.
- evidence: read
- severity: low

## Departing ghosts draw a clipping container's children unclipped
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:60-73 (draw)
- scenario: a removed node with `clip: 'outline'` / `clipFromPose` and children, under `poseTransition exit`. The scene's own walk (`buildSceneTree.ts:234`) and the preview ghost (`usePreviewGhostLayer.ts:112-116`) wrap children in `ownClipOf(...)`; the departure layer pushes the children straight into the group with no clip, so for the length of the exit glide the children spill outside the shape that clipped them a frame earlier. Same decision answered two ways across the two ghost layers.
- evidence: read
- severity: low

## A node removed from under a hidden container still in the scene fades out visibly
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:63,74-78 (draw, leaving.map)
- scenario: with `poseTransition exit`, delete (e.g. from a layers panel) a child of a group that stays in the scene but is hidden (`hidesSubtree(parent)`). The scene painted nothing under that group, yet the ghost gates only on `hidesSubtree(r.node)` and its own layer's visibility, never on the surviving ancestors, so a node the user never saw draws and fades out for the length of the exit.
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

