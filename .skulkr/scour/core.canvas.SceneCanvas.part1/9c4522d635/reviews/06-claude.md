## A partial `selectionOverlay.handles` drops the device-scaled handle size
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:63 (mergeLayersWithDefaults)
- scenario: on a coarse-pointer device (`targetScale` > 1), `layers={{ selectionOverlay: { handles: { fill } } }}` shallow-spreads over `{ handles: { size: targetSizesPx(targetScale).handle } }`, so `handles` becomes `{ fill }` and the scaled `size` is gone. The overlay then paints at the layer's own default size, while the hit radius stays scaled. Restyling the handles should not shrink them back to mouse size. Merging `handles` one level deeper, or filling `size` when the user's `handles` object leaves it out, would keep it.
- evidence: read (merge). That the overlay falls back to an unscaled size is inference: I did not locate its default.
- severity: medium

## Two presets that refine each other crash `mergeByKey` with a TypeError
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey); the cycle comes from packages/core/src/canvas/SceneCanvas/features.ts:241 (resolveFeatures `place`)
- scenario: preset A has `refines: ['b']` and preset B has `refines: ['a']`. `place` records both `direct` edges, so `refines(a,b)` and `refines(b,a)` are both true. If both give a different value for one layer slot, tool id, chrome rule, `selection` or `selectionChrome`, the conflict check passes because each refines the other. Then `all.find(...)` finds no giver that nothing refines, returns `undefined`, and `undefined.value` throws `TypeError: Cannot read properties of undefined`. It should either throw the named "[SceneCanvas] presets … refine each other" error, or reject the refinement cycle in `resolveFeatures`.
- evidence: read
- severity: low

## The image insert preview ignores a flipped view
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:73 (insertPreviewCommands)
- scenario: with a view whose `scale.x` or `scale.y` is negative, the outline is carried through `toScreen` and flips. The bitmap, though, is placed at `boundsOfPath(pathCmd)`, which is always a positive axis-aligned box, so the image draws unmirrored. The committed node draws mirrored under the same view. The function's own comment promises that a flipped or stretched view draws the preview as it draws the node the drag inserts.
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

<!-- done: 3 findings, files read: 45 -->
