# Findings: core.canvas.SceneCanvas.part1

## mergeByKey throws a bare TypeError when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey)
- scenario: preset A has `refines: ['B']` and preset B has `refines: ['A']`, and both give the same layer slot (or tool id, chrome rule, `selection`, `selectionChrome`) different values. `resolveFeatures`'s `place` records both directions in `direct`, so `refinesRelation` reports `refines(A,B)` and `refines(B,A)` as true. The conflict check passes, because each refines the other. Then `all.find(...)` excludes both givers, since each is refined by the other, so it returns `undefined`, and the `!` assertion lets `top.value` throw `TypeError: Cannot read properties of undefined`. It should either reject the refinement cycle with a `[SceneCanvas]` error naming the presets, or settle the key the way the doc describes.
- evidence: read (traced resolveFeatures place() → refinesRelation → mergeByKey)
- severity: low

## An image insert preview is drawn upright under a flipped view, while every outline beside it is flipped
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:68 (insertPreviewCommands)
- scenario: take a view with a negative `scale.y` (a y-up camera) or a negative `scale.x`, and drag an image insert tool whose bitmap has decoded. The outline is carried through `toScreen`, so it flips as the comment at line 32 promises ("a flipped or stretched view draws the preview as it draws the node the drag inserts"). The bitmap, though, is pushed as an `image` command at `boundsOfPath(pathCmd)`, a positive screen box with no transform, so it draws unmirrored. The node the drag commits is painted through the flipped view and appears mirrored, so preview and result disagree. The image command should be wrapped in a group carrying the view's flip, or drawn with a transform.
- evidence: read
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

<!-- done: 2 findings, files read: 45 -->
