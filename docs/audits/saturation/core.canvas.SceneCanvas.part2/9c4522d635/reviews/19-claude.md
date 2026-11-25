# Findings: core.canvas.SceneCanvas.part2

## Departure ghosts compose a removed container's children straight onto its pose, skipping the frame it gives them
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:81 (draw, inside useDepartureGhostLayer)
- scenario: A removed container's children are drawn at `compose(pose, c.pose)`. But `RemovedNode.pose` is "in its stored frame", meaning the frame the parent gives its children. That frame is `childFrameAt(adapter, id, world)`, which is the world pose itself only when the node defines a frame and has no `childFrame`. The removal root goes through `composeChildFrame(frames, parent, compose)`, so it gets this right. Its descendants do not.
  - Example: under `poseTransition={{ exit }}`, delete an envelope group (`dependsOn: 'children'` with `derivePose`, so `definesFrame` is false). Its children's poses are stored in the frame above the group, yet each one is composed with the group's pose again. The leaving children jump by the group's offset for the whole exit glide.
  - The same happens to a removed scrolled container, whose `childFrame` (from `viewPoseAdapter`'s scroll offsets) is ignored.
  - Expected: each child composes under `childFrameAt(frames-like adapter for r.node, r.node.id, pose)`, as the root does.
- evidence: read (`composeFrame.ts:111-123` childFrameAt/definesFrame; `effectivePose.ts:370` definesFrame false for envelopes; `poseWrites.ts:44` stored-frame doc)
- severity: medium

## Departure ghosts ignore `layerVisibility` / `layerOrder`, so a node on a layer the canvas does not paint is seen leaving
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:58 (draw: `shown` set)
- scenario: The scene's paint gates its layers through `layerVisibility` and `layerOrder` (`documentLayersOf` / `paintedLayers`), and picking does the same through `viewLayerGate`. The departure layer gates only on `scene.layers[].visible`.
  - Example: with `layerVisibility={{ notes: false }}`, an undo or a delete removes a node on `notes`. The exit glide paints a ghost of a node that was never on screen.
  - The preview-ghost layer (`usePreviewGhostLayer.ts:83`) answers this question the same way, against the painter.
  - Expected: both layers gate on the same painted-layer answer the scene slot uses.
- evidence: read (`useSceneColorAt.ts:14-24` documentLayersOf; `useScenePicking.ts` viewLayerGate)
- severity: low

## A preset's own tool that inserts nothing stays mounted when `defaultTools` or `tools={{ id: true }}` names it and a build offers it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:52-66 (resolveToolRegistry)
- scenario: Take a preset whose build offers a tool under the id of the preset's own tool, so `offered` holds the winner. Name that id in `defaultTools` or patch it `true`.
  - The first loop then `setOwn`s it into the registry. The own-tools loop finds `insertsNothing` and `continue`s, but never deletes the entry already placed.
  - So the tool the second loop meant to leave out "so it cannot be chosen" is choosable. It also comes with a dev warning claiming it was left out.
- evidence: read
- severity: low

## `useViewportWithoutView` warns about navigation being dead when the `viewport` prop only switches navigation off
- where: packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:10 (useViewportWithoutView)
- scenario: On a canvas without `corePresets.view`, pass `viewport={{ pan: false, zoom: false }}` or `viewport={{ edgePan: false }}`. Any defined value other than `recenter` or `inertia` counts as configuring navigation, `false` included.
  - The dev build then warns "wheel, pinch, and the zoom keys do nothing", although the caller asked for exactly that.
  - Expected: only values that turn something on (anything but `false`) count.
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
