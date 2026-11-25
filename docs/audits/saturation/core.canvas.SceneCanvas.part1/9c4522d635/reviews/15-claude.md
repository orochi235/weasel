# Findings: core.canvas.SceneCanvas.part1

## mergeByKey throws a TypeError, not its conflict message, when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey)
- scenario: preset `a` has `refines: ['b']` and `b` has `refines: ['a']`, both on one canvas. `resolveFeatures`' `place` records `direct` b→a and a→b, so `refinesRelation` answers true both ways. Give both a `layers.grid` (or a tool id, a chrome rule, a `selection` factory) with different values: the conflict check passes, because each refines the other, then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` finds no winner and `top.value` throws `Cannot read properties of undefined`. It should either reject the refinement cycle with a message naming both presets, or pick a deterministic winner.
- evidence: read (features.ts `place` builds the cycle; presetMerge.ts non-null assertion on `find`)
- severity: low

## features.ts names editing's presets as core's own
- where: packages/core/src/canvas/SceneCanvas/features.ts:10 (module doc)
- scenario: the header says "Core's own are exported objects (`presets.select`, `presets.draw`)". `select` and `draw` are exported by `@weasel-js/editing` (`packages/editing/src/presets.ts:21,30`); core's own presets are `view` and `viewTools` (`@weasel-js/core/presets`, `import-shims/presets.ts`). A reader looking for `select` in core finds nothing.
- evidence: read
- severity: low

## An image insert preview ignores a flipped view and draws in none of the copies
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:66 (insertPreviewCommands)
- scenario: the comment at the top says every outline is carried through `toScreen` "so a flipped or stretched view draws the preview as it draws the node". The image bitmap, though, is pushed as an axis-aligned `image` command at `boundsOfPath(pathCmd)`, so under a view with `scale.x < 0` it is drawn unmirrored while the inserted node will paint mirrored. And the `ov.copies` loop wraps only the outline `cmd`, so each copy shows an outline with no bitmap even though the committed image paints in every copy.
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
