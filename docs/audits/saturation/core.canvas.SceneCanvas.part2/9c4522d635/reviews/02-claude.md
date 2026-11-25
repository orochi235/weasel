# Findings: core.canvas.SceneCanvas.part2

## Departure ghosts fold an envelope parent's own pose into its children, which the scene's composition skips
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:94 (draw, top-level `world`) and :72 (recursive `compose(pose, c.pose)`)
- scenario: with `poseTransition` exit on, delete a child of an envelope group (`dependsOn: 'children'` + `derivePose`, which `definesFrame` says is no frame) that sits at, say, (100,100). `composeChildFrame(frames, parent, compose)` calls `composeWorldPose(frames, envelopeId)`, which always folds the envelope's *own* pose in as `chain[0]` (`definesFrame` only skips ancestors of the id), and `childFrameAt` then returns that unchanged. So the ghost is drawn at compose(envelopeWorld, childPose): offset by the envelope's position, where the scene drew the child at compose(envelopeParentFrame, childPose). The same happens in the recursion when the removed node is itself an envelope: its children are composed under `pose` (the envelope's) with no `definesFrame(r.node)` check. Expected: the ghost leaves from where the node was painted, composing only through frame-defining ancestors, as `composeWorldPose` does for live nodes.
- evidence: read (`composeFrame.ts:84-123`, `effectivePose.ts:370`)
- severity: medium

## A preset's own tool named in `defaultTools` skips the "inserts nothing" check
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:51-57 (resolveToolRegistry)
- scenario: a preset's own tool `foo` whose every `insert` binding names a kind no insert factory builds. With `defaultTools={['foo']}`, its id is in `offered` (args.offered holds own-tool winners), so the first loop mounts it because `defaultTools.includes('foo')`. The second loop then sees `insertsNothing` and `continue`s, but never removes the entry the first loop set, so a tool documented as "left out, so it cannot be chosen" is mounted anyway. Without `defaultTools` naming it the tool is left out. Expected: the same answer whichever way the id is asked for (delete the entry, or run the check in the first loop too).
- evidence: read (`features.ts:334-353`: `presetBuiltinTools` holds builtins only, `presetOwnTools` the own tools)
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

<!-- done: 2 findings, files read: 45 -->
