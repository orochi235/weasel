# Findings: core.canvas.SceneCanvas.part2

## A preset's own tool that inserts nothing stays mounted when `defaultTools` or a `tools` patch of `true` names it, though the canvas warns it is left out
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:53 (resolveToolRegistry)
- scenario: a preset owns tool `X`, and its `build` also offers `X`, so `offered` holds `X`. No insert factory builds the kind `X` inserts. The caller passes `defaultTools={['X']}` (or `tools={{ X: true }}`). The first loop walks `Object.keys(offered)`, finds `asked` true and `setOwn(registry, 'X', offered.X)`. The own-tool loop then sees `insertsNothing` and `continue`s, after warning that "tool "X" is left out". But it never deletes the entry the first loop wrote. Result: the tool is still in the registry and can be chosen, so it inserts nothing. What should happen: the `insertBuilds` gate decides for an own-tool id however it was asked for, so the tool is dropped as the warning says.
- evidence: read
- severity: medium

## The `actions` prop's "warn once" warnings repeat on every render when `actions` is an inline literal
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:39 (useActionsPropResolver)
- scenario: `<SceneCanvas actions={{ 'select.click': { id: 'other', label: 'X' } }}>` written inline. The effect is keyed on `actions` identity, so it reruns every render, and each run makes a fresh `warnedIds` set. So the slot-key mismatch warning fires on every parent render, and so does the queued "partial Action but no default" warning. Each run also releases and re-registers every merged descriptor, notifying every registry subscriber. The module doc promises "warns once on mismatch". What should happen: `warnedIds` lives outside the effect (a ref), or the effect is keyed on the prop's content.
- evidence: read
- severity: low

## A `selectionOverlay` slot with `outline.follow: 'shape'` and `poseById` puts chrome on the stroke under `boundsIncludeStroke: false`
- where: packages/core/src/canvas/SceneCanvas/useSelectionOverlayLayer.ts:55 (useSelectionOverlayLayer)
- scenario: `geometry.boundsIncludeStroke: false`, so `scenes.measured` is undefined, plus a slot of `{ outline: { follow: 'shape' }, poseById }` with no `scene` of its own. `shapeScene` becomes `scenes.shapes` and is spread as `scene`. The `poseById` branch then adds no `scene`, because `cfg.scene ?? scenes.measured` is undefined, so `scene: shapes` stays. `SelectionLayerCommon.scene` is documented as "With it, a stroked node's chrome sits on its stroke" (selectionChrome.ts:34). So the boxes get measured with stroke even though the canvas said not to include it. What should happen: the shape-tracing scene and the stroke-measuring scene stay separate, or follow-shape doesn't turn on stroke measuring.
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
