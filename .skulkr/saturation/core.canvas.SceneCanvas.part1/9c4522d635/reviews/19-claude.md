## mergeByKey crashes with a TypeError when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey)
- scenario: preset A `{ id: 'a', refines: ['b'], layers: { grid: g1 } }` and B `{ id: 'b', refines: ['a'], layers: { grid: g2 } }` both enabled. `resolveFeatures` records direct a→b and b→a (place(a) places b as a refiner, place(b) records a as one), so `refines(a,b)` and `refines(b,a)` are both true. The conflict loop does not throw (each refines the other), then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` excludes both and returns undefined; the `!` assertion hides it and `top.value` throws `Cannot read properties of undefined`. The same path runs for tools, chrome rules, selection and selectionChrome. Should throw the module's own "[SceneCanvas] presets … both give …" error (or pick deterministically), not an opaque TypeError.
- evidence: read (presetMerge.ts mergeByKey, features.ts resolveFeatures `place`/`direct`)
- severity: low

## Gesture bounds of an insert ignore the overlay's `copies`, so they disagree with the drawn preview
- where: packages/core/src/canvas/SceneCanvas/dispatcherGestureBounds.ts:47 (dispatcherInsertBounds)
- scenario: an insert dragged into a container that draws its children under extra affines (the `insertPreview` overlay's `copies`, routing overlay.ts:104). `insertPreviewCommands` paints the outline under each copy, but `dispatcherInsertBounds` pushes only `insertPreviewExtent(ov).bounds`, the base shape's AABB. A consumer sizing to gesture bounds, and `viewBounds: 'content'` (which counts "whatever a gesture in flight proposes"), see none of the copies' extent while the drag is in flight, though the file header promises "the reported bounds and the drawn preview can't disagree". Should union each copy's transformed extent.
- evidence: read (dispatcherGestureBounds.ts, insertPreviewCommands.ts copies loop, insertPreviewExtent.ts has no copies handling)
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
