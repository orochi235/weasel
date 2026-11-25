# Findings: core.canvas.SceneCanvas.part2

## Departure ghosts compose a removed container's children under its own pose even when it is an envelope, and skip its scrolled child frame
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:76 (draw, inside useDepartureGhostLayer)
- scenario: under a composing strategy, remove a group that derives its pose from its children (`dependsOn: 'children'` + `derivePose`, so `definesFrame` is false) while `poseTransition.exit` is on. The scene stores those children in the frame the envelope itself sits in, and `composeWorldPose` passes over the envelope. But the ghost recursion draws each child at `compose(pose, c.pose)` with `pose` as the envelope's world pose, so every child ghost is offset by the envelope's position (drawn twice as far from the origin) for the length of the exit. The same line also ignores `childFrame`: the `frames` adapter is a `viewPoseAdapter` whose `childFrame` applies a container's scroll offset (`scrollOffsets.ts:120`), and that is used only for the root's live parent (`composeChildFrame(frames, parent, compose)`). A removed scrolling container's children ghost at their unscrolled positions, jumping by the scroll offset on removal. It should pass the frame the removed node gives its children: its own pose (through the scroll `childFrame`) only when `definesFrame(r.node)`, and otherwise the frame it was composed under.
- evidence: read (`definesFrame`/`isEnvelope` at core/scene/effectivePose.ts:370; `composeWorldPose`/`childFrameAt` at core/scene/composeFrame.ts:95-123)
- severity: medium

## Departure ghosts skip the copies a repeating ancestor draws; preview ghosts draw them
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:91 (useDepartureGhostLayer draw)
- scenario: remove a node inside a container that paints copies of its subtree (the case `copiesAbove` handles), with `poseTransition.exit` on. `usePreviewGhostLayer` draws a ghost in each copy (`copiesAbove(sc, root.node.id, paintedPose)`, "or the copies vanish for the length of the gesture"). The departure layer draws only the primary ghost, so the copies vanish at once while the original fades out. The same question, where a ghost is drawn, gets two answers.
- evidence: read
- severity: low

## `useSeed` seeds a swapped-in scene with the first render's `selectionOptions.initial`
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:55 (useSeed)
- scenario: a canvas mounts with scene A and `selectionOptions={{ initial: ['a1'] }}`, then the caller swaps in a live scene B (which `useBakedScene` allows) with `initial: ['b1']`. The effect runs again for B ("once per scene"), but `first` is a ref captured at mount, so it seeds B with `['a1']`, ids B may not hold, and never with `['b1']`. It should read the current `initial` when a new scene arrives.
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

<!-- done: 3 findings, files read: 45 -->
