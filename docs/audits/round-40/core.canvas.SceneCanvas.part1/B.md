# Audit round 40 — core.canvas.SceneCanvas.part1

## A partial scene slot with an explicit `undefined` field erases the kit default, so the scene paints nothing
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:47 (mergeLayersWithDefaults)
- scenario: `<SceneCanvas layers={{ scene: { drawOne: props.drawOne, cull: true } }}>` with `props.drawOne` unset. The partial is spread over the defaults (`{ ...defaults.scene, ...user.scene }`), so `drawOne: undefined` replaces `defaultDrawOne`. `paintBoundsFor(undefined)` then returns undefined too, and `buildSceneLayer` skips every node (`if (drawOne && ...)`), so the canvas draws a blank scene. core's tsconfig has no `exactOptionalPropertyTypes`, so the type accepts this. The doc promises "a partial scene or selection-overlay config is spread over that slot's defaults" and "the defaults fill in whatever it leaves out". A key set to `undefined` should count as left out. The selection-overlay branch (line 58) has the same spread: `{ handles: undefined }` drops the device-scaled default handle size.
- evidence: read
- severity: low

## Preset `chromeRules` resolve a conflict in the opposite direction from every other preset merge
- where: packages/core/src/canvas/SceneCanvas/features.ts:380 (presetChromeRules)
- scenario: preset A `refines` preset B, and both give a `chromeRules` entry for one chrome id. `resolveFeatures` places a refiner ahead of what it refines, so the presets come in the order [A, B]. `Object.assign({}, ...rules)` lets the later one win, so B's rule overrides A's. Layers, tools, the selection factory and the selection chrome (`mergeByKey` and `oneOf`) all let the refiner win, and two unrelated presets clashing there throw. Here an unrelated clash silently keeps whichever came last.
- evidence: read
- severity: low

## The cursor and pick dev HUDs convert through the canvas's own camera over every declared view, so over a `<CanvasView>` panel they show the wrong world point and the wrong hits
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:38 (DevHuds, `toWorld`); also :46 and :50 (`pickEvery` / `pickBest` wrappers)
- scenario: a `<SceneCanvas views={[{ id: 'zoomed', bounds, ... }]} pickHud cursorCoordsHud>` with the cursor over the `zoomed` panel. `toWorld` always calls `canvasApiRef.current.clientToWorld`, which is the canvas's own camera (view zero). It never asks the view resolver. `pickEvery(world)` and `pickBest(world)` then run with no `viewId`, so the HUD lists the ids under a different world point than the one the panel shows, and its "best" can differ from what a click there selects. `usePointerPublisher` in the same area (PointerProviderIfRoot.tsx:37) answers this differently: it resolves the panel through `registry.resolver.at(...)` and `worldPointAt`. The props doc says the canvas's own conversion is used "so a readout agrees with a pick", but under a declared view it agrees with neither the panel nor the pick.
- evidence: read
- severity: low

## The insert preview throws on an image preview whose overlay carries no `extras`
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:64 (insertPreviewCommands)
- scenario: an action publishes an `insertPreview` overlay with `shape: 'image'`, box geometry and `extras: undefined`. routing's `OngoingOverlay` types `extras` as `unknown`, so this is legal, and `resolveOverlays` copies it through as is. `const e = ov.extras as Partial<...>` followed by `e.preview` throws a TypeError inside the overlay paint, every frame of the drag. An image preview with no payload should fall back to the bare outline, as the comment beside it says (the "bare outline until then").
- evidence: read
- severity: low

## A preset's own tool and another preset's built tool with one id are never merged, so `refines` and the conflict throw do not apply between them
- where: packages/core/src/canvas/SceneCanvas/features.ts:351 (presetOwnTools) and packages/core/src/canvas/SceneCanvas/presetBuild.ts:121 (usePresetBuilds)
- scenario: preset A lists a `Tool` of its own with id `lasso` in `tools`, and preset B refines A and offers a different `lasso` from its `build` (and names it in its `tools`). Each pool is merged on its own by `mergeByKey`: own tools by `presetOwnTools`, built tools by `usePresetBuilds`. Neither ever sees the other. The registry then writes the offered tool first and the own tool over it (toolRegistry.ts:55 then :66), so A's tool wins although B refines A. Two unrelated presets doing the same also go through silently. `PresetBuild.tools` (features.ts:62–66) promises that of two presets offering one id different tools, the refiner wins and an unrelated pair throws.
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
