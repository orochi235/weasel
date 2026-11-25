# Findings: core.canvas.SceneCanvas.part1

## Two presets that refine each other and give one key different values crash `mergeByKey` with a TypeError instead of a diagnosable error
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey), reached from packages/core/src/canvas/SceneCanvas/features.ts:249-250 (resolveFeatures: `layers`, `oneOf` for `selection` / `selectionChrome`), presetChromeRules, presetOwnTools, usePresetBuilds
- scenario: preset `a` has `refines: ['b']`, preset `b` has `refines: ['a']`, and both give `layers.grid` (or `selection`, `selectionChrome`, a chrome rule, a tool id) different values. `resolveFeatures` records the cycle without complaint: `place(a)` finds `b` refining `a` (direct[b] = {a}), `place(b)` finds `a` refining `b` (direct[a] = {b}). In `mergeByKey` the conflict check passes because `refines(a, b)` is true. The winner search, `all.find((g) => !all.some((o) => o.value !== g.value && refines(o.preset, g.preset)))!`, excludes both entries, since each is refined by the other, so it returns `undefined`, and `top.value` throws `TypeError: Cannot read properties of undefined (reading 'value')` from inside `<SceneCanvas>`'s render. It should either reject the cycle in `resolveFeatures` with a message naming both presets, or throw the existing "neither refines the other"-style error from `mergeByKey`.
- evidence: read (traced `resolveFeatures.place`, `refinesRelation` and `mergeByKey` by hand for the two-preset cycle)
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

<!-- done: 1 findings, files read: 45 -->
