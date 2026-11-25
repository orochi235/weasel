# Audit round 82 — core.canvas.SceneCanvas.part1

## `layers` slot given as `undefined` drops the preset's layer, though the next merge treats `undefined` as left out
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:13 (layersOverPresets)
- scenario: a preset supplies `layers: { grid: gridEntry }`; the consumer passes `layers={{ grid: showMyGrid ? myGrid : undefined }}`. `{ ...presetLayers, ...user }` copies the own `grid: undefined` key over the preset's entry, so no grid paints. The same file's `mergeLayersWithDefaults` (via `givenFields`, and `user.scene ?? {}` / `user.selectionOverlay ?? {}`) treats a slot or field given as `undefined` as left out and fills the default, and the preset doc says only a named slot "`null` included" keeps the consumer's. Expected: an `undefined` slot keeps the preset's layer, as an `undefined` scene slot keeps the default.
- evidence: read
- severity: low

## `routing` prop docs say the default classifies text; `inferredNodeRouting` has no text entry
- where: packages/core/src/canvas/SceneCanvas/props.ts:138 (SceneCanvasProps.routing doc)
- scenario: the doc says "Default `inferredNodeRouting`: groups, boolean groups, and data shaped as text, a path or an image". `inferredNodeRouting` (defaultNodeRouting.ts:46-51) holds only group, boolean, path and image; `'text'` comes only from `@weasel-js/text-tools`' preset (as defaultNodeRouting.ts:43 itself says). A consumer relying on the doc with text-shaped data and no text preset gets those nodes routed as `'unknown'` (or `'path'` when they carry a fallback path) and a binding targeting `'text'` never matches.
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

<!-- done: 2 findings, files read: 45 -->
