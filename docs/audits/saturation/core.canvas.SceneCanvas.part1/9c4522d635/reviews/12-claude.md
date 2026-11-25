## mergeByKey crashes with a TypeError when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:44 (mergeByKey)
- scenario: preset A `{ id: 'a', refines: ['b'], layers: { grid: L1 } }` and B `{ id: 'b', refines: ['a'], layers: { grid: L2 } }` on one canvas. `resolveFeatures` accepts the cycle (`place` stops on `placed`, and `direct` gets a→b and b→a), so `refines` answers true both ways. The conflict check passes (each refines the other), then `all.find(...)` excludes both givers (each is refined by the other with a different value), returns `undefined`, and `top.value` throws "Cannot read properties of undefined". Same for tools, chrome rules, `selection`, `selectionChrome`. Should either reject the refines cycle with a named error or treat it as "neither refines" and throw the existing conflict message.
- evidence: read
- severity: low

## An image insert preview ignores the view's flip and the shape's copies
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:64 (insertPreviewCommands)
- scenario: the outline is carried through `toScreen` (so a view with `scale.x < 0` mirrors it, matching the inserted node) and replicated per `ov.copies`, but the bitmap is pushed as an upright `image` command at `boundsOfPath(pathCmd)` and only once. Under a flipped view the preview image reads unmirrored while the committed node paints mirrored; with copies, each copy shows an outline but no image. The comment above `toScreen` states the intent that the preview draw as the inserted node does.
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
