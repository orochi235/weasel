## mergeByKey crashes with a TypeError when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey)
- scenario: presets A (`refines: ['B']`) and B (`refines: ['A']`) both on, each giving a different layer slot `grid` (or tool id, chrome rule, `selection`, `selectionChrome`). `resolveFeatures` records direct A→B and B→A, so the conflict check passes (each refines the other), then `all.find(g => !all.some(o => o.value !== g.value && refines(o.preset, g.preset)))` finds nothing and `top.value` throws `TypeError: Cannot read properties of undefined`. Should throw the module's own `[SceneCanvas] …` error naming the cycle (or pick one deterministically), not an anonymous TypeError from inside `resolveFeatures`.
- evidence: read
- severity: low

## useStableToolOptions' content key collides for strings containing the key syntax, so a real toolOptions change is dropped
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:137 (contentKeyOf)
- scenario: `identityKeyOf('x')` is `string:x` with the raw value unescaped, and array items are joined with `,`. So `toolOptions={{ t: { v: ['a', 'b'] } }}` and `toolOptions={{ t: { v: ['a,string:b'] } }}` both key `[string:a,string:b]`; switching between them keeps the memoized old object and the presets' `build` is never rerun with the new options. Object values collide the same way (`}`/`,"k":` inside a string). Should escape primitive strings (e.g. `JSON.stringify`) as the keys already are.
- evidence: read (identityKeyOf in packages/registry/src/part.ts:46)
- severity: low

## An image insert preview draws its bitmap unflipped on a mirrored view
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:66 (insertPreviewCommands)
- scenario: view with `scale.x < 0` (a flipped camera, which `sceneViewBounds` and the outline code explicitly handle). The outline goes through `toScreen` and mirrors, but the bitmap is placed at `boundsOfPath(pathCmd)` — a positive screen rect — with no transform, so the preview image reads unmirrored while the committed node is drawn mirrored. The comment at line 31 promises the preview draws "as it draws the node the drag inserts". Likewise `copies` repeat only the outline, never the bitmap.
- evidence: read
- severity: low

## Dev HUDs report client coordinates as world coordinates before the canvas api exists, and keep a stale view id
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:47 (DevHuds toWorld)
- scenario: pointer moves over the canvas before `canvasApiRef.current` is set (first frames, or a `paintInto` canvas whose surface is not ready): `toWorld` returns `[clientX, clientY]` as the world point, so the cursor HUD shows client numbers in its world row and the pick HUD picks the scene at client coordinates; `viewIdRef` is also left at whatever view a previous call resolved. Should report no world point (or skip the pick) until the api is there, and reset `viewIdRef`.
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

<!-- done: 4 findings, files read: 45 -->
