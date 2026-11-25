## Mutually refining presets crash `mergeByKey` with a TypeError instead of settling or throwing the conflict message
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey), reached from packages/core/src/canvas/SceneCanvas/features.ts:258-287 (resolveFeatures)
- scenario: preset A `{ id: 'a', refines: ['b'], layers: { grid: L1 } }` and preset B `{ id: 'b', refines: ['a'], layers: { grid: L2 } }`. `resolveFeatures`'s `place` records both directions in `direct` (A→B while placing B, B→A while placing A), so `refines('a','b')` and `refines('b','a')` are both true. The conflict check in `mergeByKey` passes (each refines the other), then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` finds no winner, returns `undefined`, and `top.value` throws `Cannot read properties of undefined (reading 'value')`. The same applies to tools, chrome rules, `selection` and `selectionChrome`. It should either reject the refinement cycle when it is built with a named error, or treat it as "neither refines" and throw the usual conflict message.
- evidence: read
- severity: low

## An image insert preview ignores a flipped view and the insert's copies
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:63-77 (insertPreviewCommands)
- scenario: the comment at line 32 says every outline goes through `toScreen` "so a flipped or stretched view draws the preview as it draws the node". The outline does, but the bitmap is drawn as an axis-aligned `image` command at `boundsOfPath(pathCmd)`. With `view.scale.x < 0`, the outline is mirrored while the bitmap shows upright, and the inserted node then paints mirrored. Also, when `ov.copies` is set, only the outline `cmd` is wrapped into each copy's group, so the copies show bare outlines while the original shows the bitmap. The bitmap should be carried by the same transform (a group with `mat3.fromAffine(toScreen)` around a world-space image) and included in each copy's group.
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
