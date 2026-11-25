# Findings: core.canvas.SceneCanvas.part1

## mergeByKey throws a bare TypeError when two presets refine each other and give one key different values
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:46 (mergeByKey)
- scenario: preset A `refines: ['B']`, preset B `refines: ['A']` (`resolveFeatures` accepts the cycle: `place` stops on `placed`), and both give layer slot `grid` (or a tool id, a chrome rule, `selection`) different values. The conflict check passes, since `refines(A, B)` is true. Then in the pick, each giver has an other with a different value that refines it, so `all.find(...)` returns `undefined` and the `!`-asserted `top.value` throws "Cannot read properties of undefined (reading 'value')" from inside `resolveFeatures`. It should either reject the cycle with a `[SceneCanvas]` error naming the two presets, or settle it the way a non-refining pair is settled (the conflict error).
- evidence: read
- severity: low

## A singular copy matrix turns the pick query's slop into Infinity/NaN
- where: packages/core/src/canvas/SceneCanvas/scenePointQuery.ts:59 (bareQuery.inCopy)
- scenario: a copy `m` with a zero determinant (a repeat or array copy scaled to 0 on one axis) gives `k = 0`, so the copy query's scale is `{ x: s.x / 0, y: s.y / 0 }` = Infinity. `meanScale` and the `{ px, scale }` slop then come out Infinity or NaN, and the containment and stroke tests compare against NaN. A copy that collapses to a line should hit nothing (or test exactly). It should not run the hit tests with non-finite tolerances. `insertPreviewCommands` guards the same case (`invert` → null → break). This one has no guard.
- evidence: read
- severity: low

## An image insert preview ignores a flipped view and the copies it is drawn in
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:63 (insertPreviewCommands)
- scenario: the function's own comment says every outline goes through `toScreen` "so a flipped or stretched view draws the preview as it draws the node the drag inserts". But the decoded bitmap is drawn as an axis-aligned `kind: 'image'` at `boundsOfPath(pathCmd)`. Under a view with `scale.x < 0` the inserted image node paints mirrored, while its preview paints unmirrored. With `ov.copies`, only the outline `cmd` is wrapped in each copy's group, so the bitmap appears once while the outline appears in every copy.
- evidence: read
- severity: low

## Two contributions declaring a view or marker with the same id collide on one React key
- where: packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx:16 (SurfaceDeclarations)
- scenario: two `SurfaceContribution`s (say, two presets' entries) each declare `views: [{ id: 'detail', ... }]`. Both render as `<CanvasView key="contribution:detail">`, so React warns about the duplicate key and may reconcile one `CanvasView` onto the other's props when the list changes, instead of mounting both or reporting the clash. Markers have the same problem (`contribution:${m.id}`). The key does not include the contribution's own id, which would keep them distinct.
- evidence: read
- severity: low

## DevHuds' client→world fallback reports client pixels as world and leaves a stale view id
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:47 (DevHuds toWorld)
- scenario: before the canvas api is set (or after it is cleared on teardown), `toWorld` returns `[clientX, clientY]` as the world point, and `viewIdRef` keeps whatever view the last conversion landed in. The pick HUD then picks at a client-pixel "world" point in a stale view, and the cursor readout shows client coords labeled as world. This differs from `traceConversion`, which marks the same identity fallback as `fallback: true`. The HUD should show no world point instead.
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

<!-- done: 5 findings, files read: 45 -->
