# Audit round 82 — core.canvas.SceneCanvas.part1

## `oneOf` and `mergeByKey` settle the same preset conflict differently: one throws, the other silently keeps a value
- where: packages/core/src/canvas/SceneCanvas/features.ts:304 (oneOf) vs packages/core/src/canvas/SceneCanvas/presetMerge.ts:38 (mergeByKey)
- scenario: presets placed X, Y, W, where X refines W, Y refines nobody, X and Y give the same value S and W gives T. `mergeByKey` moves the owner to Y when Y repeats X's value, so at W it compares W against Y. Neither refines the other, so it throws "presets "Y" and "W" both give …". `oneOf` skips Y on the equal value and keeps X as the owner. At W, `refines(X, W)` holds, so W is skipped and S is returned with no error. The same three presets therefore throw when they conflict over a layer slot, a tool or a chrome rule, but resolve quietly when they conflict over `selection` or `selectionChrome`. Y's unrefined conflict with W is never reported on that path. One rule should decide both, and the doc on `oneOf` says it works "as in `mergeByKey`".
- evidence: read
- severity: low

## `layersOverPresets` treats a slot given as `undefined` as an override and drops the preset's layer
- where: packages/core/src/canvas/SceneCanvas/mergeLayers.ts:10 (layersOverPresets)
- scenario: a preset supplies `layers: { grid: gridLayer }` and the consumer passes `layers={{ grid: show ? myGrid : undefined }}`. `{ ...presetLayers, ...user }` copies the `undefined` over the preset's grid, so the preset's grid is lost. In the same file, `givenFields` treats "a field given as `undefined`" as "one left out", and the `scene` slot falls back to its default when set to `undefined`. The doc promises that only a slot the consumer *names*, `null` included, keeps the consumer's value. An `undefined` slot should leave the preset's layer in place, as `null` is the explicit way to remove it.
- evidence: read
- severity: low

## `routing` prop doc says the default classifies "data shaped as text", but `inferredNodeRouting` has no text entry
- where: packages/core/src/canvas/SceneCanvas/props.ts:126 (SceneCanvasProps.routing doc)
- scenario: the doc says "Default `inferredNodeRouting`: groups, boolean groups, and data shaped as text, a path or an image". `inferredNodeRouting` (defaultNodeRouting.ts:46) holds only `group`, `boolean`, `path` and `image`, and `text` comes only from `@weasel-js/text-tools`' preset. A consumer who relies on the doc and omits that preset finds text nodes routed as `'unknown'`, or as `'path'` when they carry a fallback path, so text-edit bindings never match.
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
