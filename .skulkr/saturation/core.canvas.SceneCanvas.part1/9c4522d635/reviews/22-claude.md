# Findings: core.canvas.SceneCanvas.part1

## Mutually refining presets crash `mergeByKey` with a TypeError instead of a usable error
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey), fed by packages/core/src/canvas/SceneCanvas/features.ts:263 (resolveFeatures `place`)
- scenario: preset A has `refines: ['b']`, preset B has `refines: ['a']` (directly or through a longer cycle), and both give one key different values (a layer slot, a chrome rule, a tool id, `selection`). `resolveFeatures` places them without complaint and `refinesRelation` answers true both ways, so the conflict check passes. Then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` finds nothing, and `top.value` throws `Cannot read properties of undefined`. It should either reject the refines cycle when placing presets, or throw the usual "[SceneCanvas] presets … both give …" error.
- evidence: read
- severity: low

## `contentKeyOf` gives equal keys to different string arrays, so changed `toolOptions` are not seen
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:139 (contentKeyOf), used by useStableToolOptions
- scenario: strings are keyed as `string:<raw>` and joined with an unescaped `,` (object keys are JSON-escaped, but values are not). So `['a', 'b']` and `['a,string:b']` both key to `[string:a,string:b]`. When `toolOptions` changes from one of these to the other, `useStableToolOptions` returns the old object and tools are not rebuilt with the new options. Values should be escaped, for example with `JSON.stringify` for primitives.
- evidence: read (identityKeyOf in packages/registry/src/part.ts:46)
- severity: low

## Image insert preview is drawn unmirrored in a flipped view, against its own stated contract
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:68 (insertPreviewCommands)
- scenario: with a view where `scale.x < 0` (or `scale.y < 0`), the outline is carried through `toScreen` and mirrors correctly. The bitmap, though, is pushed as an axis-aligned `image` command at `boundsOfPath(pathCmd)`, so it reads the right way round, while the node the drag commits renders mirrored through the view. The comment at line 34 says a flipped view draws the preview as it draws the inserted node; for images it does not. The image should be drawn under the flip (for example a group with `mat3.fromAffine(toScreen)` around a world-rect image).
- evidence: read (viewToTransform has no rotation; scale sign is carried into toScreen)
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
