## A partial `selectionOverlay.handles` drops the device-scaled handle size
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:63 (mergeLayersWithDefaults)
- scenario: `layers={{ selectionOverlay: { handles: { fill: … } } }}` on a coarse-pointer device (targetScale > 1). The slot config is shallow-spread over the defaults, so the consumer's `handles` object replaces `{ size: targetSizesPx(targetScale).handle }` whole; the handle style ends up with no `size`, and the handles fall back to whatever unscaled size the overlay uses when none is given, instead of the touch-scaled size. Restyling the handles' color should not shrink them on touch devices. `handles` (a `SelectionHandleStyle`, all fields optional) needs a one-level merge, like the scene slot gets.
- evidence: read (merge code and `SelectionHandleStyle` in selectionChrome.ts:16); the fallback size used downstream is inference
- severity: low

## The dev pick HUD asks about the wrong view when the canvas api is not up yet
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:49 (DevHuds toWorld)
- scenario: while `canvasApiRef.current` is null, `toWorld` returns the client point unchanged and returns before updating `viewIdRef`, so the `pickEvery`/`pickBest` that follow in the same handler pass the view id from the previous conversion (a view the pointer may no longer be over) along with an untransformed point. `viewIdRef` should be reset to null on that early return.
- evidence: read
- severity: low

## The image insert preview is drawn unflipped under a flipped view
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:66 (insertPreviewCommands)
- scenario: with a view whose `scale.x` or `scale.y` is negative, the outline is carried through `toScreen` and comes out mirrored, but the bitmap is placed at `boundsOfPath(pathCmd)`, a positive box, with no transform. The bitmap stays unmirrored, which contradicts the function's own comment that a flipped or stretched view draws the preview the way it draws the inserted node.
- evidence: read (whether the committed image node mirrors under a flipped view is inference)
- severity: low

## Files read
packages/core/src/canvas/SceneCanvas/ActionsProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/CanvasKitProviders.tsx
packages/core/src/canvas/SceneCanvas/DepRegistryProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/DevHuds.tsx
packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/PresetComponents.tsx
packages/core/src/canvas/SceneCanvas/SceneCanvasInput.tsx
packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx
packages/core/src/canvas/SceneCanvas/actionProps.ts
packages/core/src/canvas/SceneCanvas/brushOverlay.ts
packages/core/src/canvas/SceneCanvas/builtinToolSets.ts
packages/core/src/canvas/SceneCanvas/canvasPassThrough.ts
packages/core/src/canvas/SceneCanvas/contributionFrameHooks.ts
packages/core/src/canvas/SceneCanvas/coordTrace.ts
packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts
packages/core/src/canvas/SceneCanvas/defaultNodeRouting.ts
packages/core/src/canvas/SceneCanvas/describePresets.ts
packages/core/src/canvas/SceneCanvas/dispatcherGestureBounds.ts
packages/core/src/canvas/SceneCanvas/features.ts
packages/core/src/canvas/SceneCanvas/geometryProps.ts
packages/core/src/canvas/SceneCanvas/ingestionProps.ts
packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts
packages/core/src/canvas/SceneCanvas/longPressProps.ts
packages/core/src/canvas/SceneCanvas/mergeLayers.ts
packages/core/src/canvas/SceneCanvas/nodeTraits.ts
packages/core/src/canvas/SceneCanvas/pathEditHost.ts
packages/core/src/canvas/SceneCanvas/pointerProps.ts
packages/core/src/canvas/SceneCanvas/poseGeometry.ts
packages/core/src/canvas/SceneCanvas/poseRegistrars.tsx
packages/core/src/canvas/SceneCanvas/presetBuild.ts
packages/core/src/canvas/SceneCanvas/presetMerge.ts
packages/core/src/canvas/SceneCanvas/presetTraits.ts
packages/core/src/canvas/SceneCanvas/presets/baseline.ts
packages/core/src/canvas/SceneCanvas/presets/chrome.ts
packages/core/src/canvas/SceneCanvas/presets/index.ts
packages/core/src/canvas/SceneCanvas/presets/toolDriven.ts
packages/core/src/canvas/SceneCanvas/presets/view.ts
packages/core/src/canvas/SceneCanvas/presets/viewTools.ts
packages/core/src/canvas/SceneCanvas/props.ts
packages/core/src/canvas/SceneCanvas/sampleProps.ts
packages/core/src/canvas/SceneCanvas/scenePointQuery.ts
packages/core/src/canvas/SceneCanvas/sceneProps.ts
packages/core/src/canvas/SceneCanvas/sceneViewBounds.ts
packages/core/src/canvas/SceneCanvas/selectToolProps.ts
packages/core/src/canvas/SceneCanvas/shapeGeneratorProperties.ts

<!-- done: 3 findings, files read: 45 -->
