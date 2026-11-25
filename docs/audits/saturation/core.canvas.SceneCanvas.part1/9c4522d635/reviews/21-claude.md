# Findings: core.canvas.SceneCanvas.part1

## Every preset's `build` reruns whenever any preset is turned on or off, against the contract that it runs once per canvas and preset
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:119 (usePresetBuilds), contract at packages/core/src/canvas/SceneCanvas/features.ts:180 (FeaturePreset.build doc)
- scenario: a canvas with `features={[presets.select, myPreset]}` (myPreset has `build`) adds `corePresets.view`. `useCanvasTools` re-resolves features (new `featuresKey`), so `enabled.presets`/`builds`/`buildOwners`/`refines` are all fresh arrays/closures, and the `useMemo` in `usePresetBuilds` calls `myPreset.build(ctx)` again. Its tools come back as new `Tool` objects, so the tool registry sees changed tools for a preset that did not change. The `build` doc says "the canvas calls it once per canvas and preset, and again only when `toolOptions` changes". Either the memo should be per build function (keyed by the build and `ctx`), or the doc is wrong.
- evidence: read (the memo deps; `resolveFeatures` is memoized only on the features key in `useCanvasTools.ts:38`)
- severity: medium

## A copy matrix with zero determinant makes the copy's pick query divide by zero
- where: packages/core/src/canvas/SceneCanvas/scenePointQuery.ts:54 (inCopy)
- scenario: a repeat/copy transform `m` that collapses an axis (scale 0 on one axis, or a degenerate shear) gives `k = sqrt(|det|) = 0`, so the query is built with `s = { x: Infinity, y: Infinity }` (or NaN for 0/0 when `s` is 0). `meanScale`, the slop's `scale` and every tolerance computed from it are then non-finite. The point is also mapped with `m` itself (`transformPoint(m, px, py)`), and a singular `m` has no inverse, so the copy is tested in the wrong frame. A copy that draws nothing should be skipped; `insertPreviewCommands` does skip one (`invert` returns null, then `break`).
- evidence: read
- severity: low

## An image insert preview ignores a flipped view and is left out of the copies
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:68 (insertPreviewCommands)
- scenario: (1) With a view whose `scale.x` or `scale.y` is negative, the outline is carried through `toScreen` and is drawn flipped. The bitmap, though, is placed at `boundsOfPath(pathCmd)`, the normalized positive rect, so it draws unmirrored while the outline is mirrored. The function's own comment says a flipped view should draw the preview as it draws the inserted node. (2) With `ov.copies`, only the outline `cmd` is wrapped in a group per copy, so the copies show an outline with no bitmap, while the original shows the bitmap.
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
