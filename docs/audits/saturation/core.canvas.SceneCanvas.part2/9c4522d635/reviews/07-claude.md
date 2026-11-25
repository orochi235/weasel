# Findings: core.canvas.SceneCanvas.part2

## Muting the marker-drag action per id leaves view markers claiming presses
- where: packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:130 (useCanvasTools, `markerDrag`), with packages/core/src/canvas/SceneCanvas/useSceneGestureDispatcher.ts:200 (useMarkerGate)
- scenario: `actions={{ [VIEW_MARKER_DRAG]: null }}` (the documented per-id opt-out) mutes the drag action, but `markerDrag` is dropped only for `actions === null`, so the `view-marker` contribution stays installed. `useMarkerGate` then still reports markers as gated on, and `affordanceAt` hands a press on a marker to `viewRegistry.markerAt`, which classifies it as a marker affordance bound to a muted action. The press grabs a marker that cannot move, where it should behave as with `actions={null}` and fall through to the content beneath. The gate should follow whether the action is live, not whether the entry is installed.
- evidence: read (useCanvasTools, useMarkerGate, viewMarkerDrag.ts ids); the dispatcher's handling of a binding to a muted action is inferred
- severity: low

## A preset's own tool that can insert nothing is kept when `defaultTools` or `tools.<id>=true` also names it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:53 (resolveToolRegistry)
- scenario: `offered` holds the winner for an own-tool id (`args.offered`), and `ids` includes every offered key, so the first loop mounts that id when `defaultTools` lists it or the patch says `true`. The second loop's `insertsNothing` check then `continue`s without deleting the entry it already set, so the tool the doc says "is left out, so it cannot be chosen" stays in the registry, now in built-in position instead of preset order. The leave-out decision is made in one loop and silently undone by the other.
- evidence: read
- severity: low

## Departure ghosts of a removed scrolling container's children ignore its scroll
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:80 (draw, child pose)
- scenario: The root ghost is placed through `composeChildFrame(frames, parent, compose)`, and `frames` is `viewPoseAdapter(...)`, which carries the scroll offsets as `childFrame`. The removed node's own children are composed with a bare `compose(pose, c.pose)`, so `childFrame` (scroll, and any other frame mapping) is skipped for them. When a scrolled container is removed with `poseTransition exit`, its children ghost at their unscrolled positions and jump on the first frame of the exit, where the scene painted them scrolled. The parent frame should go through `childFrameAt` (or the removal's recorded scroll) as the scene's paint does.
- evidence: read (useDepartureGhostLayer, composeFrame.ts childFrameAt, scrollOffsets.ts viewPoseAdapter); whether a removed node's scroll entry survives its removal is not checked
- severity: low

## `useSeed` seeds a later scene with the first render's `selectionOptions.initial`
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is captured once. Swapping `scene` for another live scene with a new `selectionOptions.initial` (the doc says "once per scene") seeds the new scene with the old scene's ids, which name nodes it may not hold, and the new `initial` is never used. It should read the `initial` in force when the scene arrived.
- evidence: read
- severity: low

## `defaultActiveTool` doc says it is ignored under any `tools` prop, but the patch form honors it
- where: packages/core/src/canvas/SceneCanvas/toolProps.ts:55 (SceneCanvasToolProps.defaultActiveTool)
- scenario: The doc says "Ignored when the consumer supplies their own `tools` prop". `useCanvasTools` passes `defaultActiveTool` to the internal `useTools` whenever `tools` is a patch record, and `ignoredProps` warns only under a `ToolsApi` takeover. A reader passing `tools={{ pen: true }}` with `defaultActiveTool` expects it dropped; the code makes it active. The doc should say "a `ToolsApi` in `tools`".
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
