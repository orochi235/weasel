## mergeByKey throws a TypeError, not its conflict error, when two presets refine each other and disagree
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:43 (mergeByKey), with refinesRelation from features.ts:276 (resolveFeatures)
- scenario: preset A `refines: ['B']`, preset B `refines: ['A']`, both give a different value for one key (a layer slot, a chrome rule, a tool id, `selection`). `resolveFeatures` records both directions in `direct`, so `refines(A,B)` and `refines(B,A)` are both true: the conflict check passes, then `all.find(...)` excludes each giver (the other refines it) and returns `undefined`, and `top.value` throws `Cannot read properties of undefined`. It should either throw the "[SceneCanvas] presets … both give …" error or reject the refinement cycle.
- evidence: read
- severity: low

## useStableToolOptions' content key collides for strings holding the key syntax, so a changed toolOptions keeps the old tools
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:139 (contentKeyOf), via identityKeyOf (packages/registry/src/part.ts:48)
- scenario: a primitive is keyed as `${typeof v}:${String(v)}` with no escaping, and array items are joined by `,`. `toolOptions={{ x: { tags: ['a', 'b'] } }}` and `toolOptions={{ x: { tags: ['a,string:b'] } }}` both key to `{"x":{"tags":[string:a,string:b]}}`, so switching between them returns the memoized first object and no preset `build` reruns. Strings should be keyed with `JSON.stringify` (as object keys already are).
- evidence: read
- severity: low

## DevHuds' toWorld leaves the previous view id in place when the canvas api is missing
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:48 (toWorld)
- scenario: with `canvasApiRef.current` null (before mount, or after the canvas remounts its handle), `toWorld` returns the identity point and returns early without writing `viewIdRef`, so the pick HUD's `pickEvery`/`pickBest` for that point ask the view the last converted point landed in, not the surface's (`null`). It should reset `viewIdRef.current = null` on that path.
- evidence: read
- severity: low

## An image insert preview ignores a flipped view, unlike the outline drawn beside it
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:64 (insertPreviewCommands)
- scenario: under a y-up view (`scale.y < 0`), the outline goes through `toScreen` and lands flipped, but the bitmap is drawn upright at `boundsOfPath(pathCmd)`, a positive screen box. The node the drag inserts is painted through the view's flip, so the preview image is the wrong way up compared with the committed node. The comment above `toScreen` promises the preview draws "as it draws the node". Inference: I did not check how the image painter orients a bitmap under a flipped view.
- evidence: inference
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

<!-- done: 4 findings, files read: 45 -->
