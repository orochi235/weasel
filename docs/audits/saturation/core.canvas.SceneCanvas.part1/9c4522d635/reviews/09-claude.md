## Mutually refining presets crash `mergeByKey` with a TypeError instead of settling or throwing a clear error
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:43 (mergeByKey)
- scenario: preset A has `refines: ['b']` and preset B has `refines: ['a']`; `resolveFeatures` records both edges in `direct` (its `placed` guard stops the recursion, but the loop in `place` still records each `direct` entry). Both give one key different values (a layer slot, a chrome rule, a tool id, `selection`). The conflict check passes, because `refines` is true both ways. Then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` rejects both givers and returns `undefined`, and `top.value` throws "Cannot read properties of undefined (reading 'value')" while the canvas renders. It should either pick a winner or throw the `[SceneCanvas] …` message naming the cycle.
- evidence: read
- severity: low

## `isAtom` reports a preset whose `selectionChrome` is a class instance as a bundle
- where: packages/core/src/canvas/SceneCanvas/describePresets.ts:20 (filled / isAtom)
- scenario: `SelectionChrome` is an interface of three methods (`overlay`, `rotationBadgeOf`, `affordances`; packages/core/src/canvas/selectionChrome.ts:117). An implementation written as a class has no own enumerable keys, so `filled` sees `Object.keys(v).length === 0` and returns false. A preset holding only that `selectionChrome` (plus actions or built-in tools) is then described with `atom: false`, a bundle, even though it holds an atom role. The same applies to any role value that is a non-plain object with prototype-only members. `filled` should treat only arrays and plain records by their size, and any other object as filled.
- evidence: read
- severity: low

## Image insert preview is drawn unmirrored under a flipped view, while the outline and the inserted node are mirrored
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:66 (insertPreviewCommands)
- scenario: the view has `scale.x < 0` (a flipped view). The outline is carried through `toScreen` and mirrored, which matches the comment at line 31 ("a flipped or stretched view draws the preview as it draws the node"). The bitmap is drawn as a bare `kind: 'image'` at `boundsOfPath(pathCmd)`, which is always a positive rect, so the image appears unmirrored during the drag and then flips when the insert commits. Its `copies` also get only the outline, never the bitmap. The image should go through the same transform, for example a group carrying `toScreen` with the image at its world box.
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
