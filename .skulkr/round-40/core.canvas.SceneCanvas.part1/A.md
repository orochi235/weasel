I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole findings document is below. I read all 45 listed files; none was edited.

# Audit round 40 — core.canvas.SceneCanvas.part1

## A consumer's `gestureSource`, `previewPoseExtra` or `boundsOfPose` silently replaces the ones SceneCanvas wires into its `<Canvas>`
- where: packages/core/src/canvas/SceneCanvas/canvasPassThrough.ts:6 (`OWN_PROPS`), with packages/core/src/canvas/SceneCanvas/props.ts:75 (the `Omit` list in `SceneCanvasProps`)
- scenario: `SceneCanvasProps` omits only `adapter | boundsOf | selection | tools | viewState | layers | getIsVisible | contentVersion | layerVisibility | layerOrder | debug | worker` from `CanvasProps`. So `gestureSource`, `previewPoseExtra` and `boundsOfPose` type-check on `<SceneCanvas>`, and none of them is in `OWN_PROPS`. `SceneCanvas.tsx:155` spreads `canvasPassThrough(props)` *after* its own `gestureSource={gestureSource} previewPoseExtra={previewPoseExtra} boundsOfPose={picking.boundsOfPose}`, so a value the consumer passes wins. Passing `previewPoseExtra`, for example, replaces the lookup backed by the dispatcher:
  - The selection chrome stops following a drag's ghost.
  - Passing `gestureSource` makes `getGestureBounds`/`subscribeGestures` stop reporting in-flight inserts, so `viewBounds: 'content'` ignores them.
  - Passing `boundsOfPose` makes the chrome box previews with the consumer's function while the content-bounds source in `SceneCanvasInput` still reads `picking.boundsOfPose`. One question then has two answers.

  The fix is either to omit these three from `SceneCanvasProps` and list them in `OWN_PROPS`, or to compose the consumer's value with the canvas's own.
- evidence: read
- severity: medium

## A tool offered by one preset's `build` and a tool of another preset's own, both with one id, never conflict: the own tool always wins, whatever `refines` says
- where: packages/core/src/canvas/SceneCanvas/features.ts:351 (`presetOwnTools`) and packages/core/src/canvas/SceneCanvas/presetBuild.ts:121 (`usePresetBuilds`)
- scenario: The doc on `PresetBuild.tools` says two presets offering one id must refine one another or the canvas throws. But the tools a `build` offers and the tool objects in `tools` are merged by two separate `mergeByKey` calls that never see each other. `toolRegistry.ts:57-66` then writes every own tool over the offered one with `setOwn`. Take preset R (`refines: ['A']`) whose `build` offers tool `x`, and preset A with `tools: [{ id: 'x', … }]`. A's tool is mounted, though R refines A and should win. Two unrelated presets in the same position don't throw either; the own tool just silently replaces the other.
- evidence: read
- severity: low

## `toolOptions` entries holding an array or object field rebuild every preset's tools on every render
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:127 (`useStableToolOptions`)
- scenario: The memo key compares each entry's fields with `identityKeyOf`, which gives every object a key of its own. `toolProps.ts:49` names `insert.behaviors` (an array) as the example option. An inline `toolOptions={{ insert: { behaviors: [snap] } }}` therefore gets a new key each render. Every `build` re-runs and makes new `Tool` objects each render, which contradicts the contract on `FeaturePreset.build` ("again only when `toolOptions` changes"). The tool registry churns underneath any gesture in flight. Only the one-level case (`{ lasso: { mode } }`) is actually kept stable.
- evidence: read
- severity: low

## Two presets installing one painter at different priorities resolve silently to the first, where every other node-kind trait conflict throws
- where: packages/core/src/canvas/SceneCanvas/presetTraits.ts:93 (`presetShapes`)
- scenario: `presetShapes` dedupes by `painter` alone and keeps the first entry's `priority`. Say preset A gives `shapes: [textShape]` and preset B gives `shapes: [{ painter: textShape, priority: 'high' }]`. With A placed first, the painter registers at the default tier and B's `'high'` is dropped without a word. Routing entries, insert factories and properties entries with clashing values all throw through `claimPresetNames`. So this conflict between presets gets two different answers.
- evidence: read
- severity: low

## A partial scene slot with a key set to `undefined` drops the default `drawOne` or `paintBounds`
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:47-50 (`mergeLayersWithDefaults`)
- scenario: `{ ...defaults.scene, ...user.scene }` lets an explicitly undefined key win, and `'paintBounds' in user.scene` is true for `paintBounds: undefined`.
  - `layers={{ scene: { drawOne: custom ?? undefined } }}` with no custom painter leaves the slot with `drawOne: undefined` instead of `defaultDrawOne`. Its `paintBounds` falls back to `paintBoundsFor(undefined)`, and painting has no painter.
  - `{ scene: { drawOne: defaultDrawOne, paintBounds: maybe } }` with `maybe` undefined drops culling.

  The doc promises "partial slot configs are shallow-spread on top of the default", and a conditionally-set field reads as "not given".
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