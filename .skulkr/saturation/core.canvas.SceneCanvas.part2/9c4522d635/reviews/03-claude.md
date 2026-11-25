# Findings: core.canvas.SceneCanvas.part2

## A preset's own tool that inserts nothing is still mounted when `defaultTools` or `tools: { id: true }` names it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:53-71 (resolveToolRegistry)
- scenario: a preset owns tool `rect`, and its `build` offers it, so `rect` is in `args.offered`. No insert factory on the canvas builds `rect`'s kind, so `insertBuilds('rect')` is false. The consumer passes `defaultTools={['rect']}` or `tools={{ rect: true }}`. The first loop walks `Object.keys(offered)`, finds `asked` true, and runs `setOwn(registry, 'rect', offered.rect)`. The second loop then hits `insertsNothing`, warns that "tool "rect" is left out", and `continue`s, but the entry from the first loop stays in the registry. The tool can be chosen and inserts nothing, while the warning says it was left out. The `insertsNothing` gate should apply to every path that mounts a preset's own tool, or the first loop should skip ids in `presetOwnTools(enabled)`.
- evidence: read
- severity: medium

## On scene swap, the selection seed uses the `initial` captured at mount, not the current prop
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53-62 (useSeed)
- scenario: a canvas mounts with scene A and `selectionOptions.initial=['a1']`. Later the consumer swaps `scene` to B and `initial` to `['b1']`. `useSeed` re-seeds per scene, but it reads `first.current`, which is frozen at `['a1']`. So scene B gets seeded with an id from A (an id B does not hold), or seeded wrong, and `['b1']` is never applied. The seed for a new scene should read the `initial` that is current when that scene arrives.
- evidence: read
- severity: low

## A tool's `extendClickLocked` set to `undefined` in `selectTool` erases the kit's path-edit lock
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasPathEdit.ts:35-40 (selectToolWithDefaults)
- scenario: `selectTool={{ extendClickLocked: cond ? fn : undefined, ... }}`. Spreading `...selectTool` after the default writes `extendClickLocked: undefined` over it. While a path is being anchor-edited, shift-click then extends the node selection instead of the anchor selection. A default meant to fill in a missing option should not be removed by a key that is present but undefined. Spread only the defined keys, or apply `selectTool.extendClickLocked ?? default`.
- evidence: read
- severity: low

## The handle `addView` returns keeps drawing its id after a re-add has replaced its props
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts:18-26 (addView)
- scenario: `const h1 = api.addView({ id: 'v', ...A })`, then `api.addView({ id: 'v', ...B })`. The second call filters A out of the list by id. `h1.remove()` filters by identity against A and is a no-op, which is fine. But `h1.draw` looks the view up by id in the registry, so it keeps drawing B. A handle the canvas has already replaced still answers as the live view. `draw` and `remove` decide differently whether `h1` still exists.
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
