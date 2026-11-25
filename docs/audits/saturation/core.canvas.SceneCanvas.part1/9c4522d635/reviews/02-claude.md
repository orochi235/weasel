# Findings: core.canvas.SceneCanvas.part1

## Toggling any one preset re-runs every preset's `build`, contrary to `build`'s "once per canvas and preset" contract
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:125 (usePresetBuilds, second useMemo)
- scenario: `features={[presets.draw, myPreset]}` → add or remove an unrelated preset (or flip `selectTool.rotate`). `useEnabledFeatures` re-resolves, producing new `presets`/`builds`/`buildOwners`/`refines` identities (and `withoutSelectRotate` new preset objects), so the memo calls every surviving preset's `build(ctx)` again and hands back fresh `Tool` objects for tools that did not change. `FeaturePreset.build` (features.ts:174) promises it is called "once per canvas and preset, and again only when `toolOptions` changes"; a build that allocates state or a tool keyed by identity is rebuilt and its tools re-register. Should memoize per build function (e.g. a per-`build` cache keyed on `ctx`).
- evidence: read
- severity: medium

## Two presets that refine each other and give one key different values crash with a TypeError instead of a merge or a message
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:47 (mergeByKey)
- scenario: preset A `{ id: 'a', refines: ['b'], layers: { grid: g1 } }` and B `{ id: 'b', refines: ['a'], layers: { grid: g2 } }`. `resolveFeatures` records both directions in `direct` (its `placed` guard stops the recursion, not the edge), so `refines(a,b)` and `refines(b,a)` are both true: the conflict check does not throw, then `all.find(...)` finds no giver not refined by a differing one and returns `undefined`; `top!.value` throws `Cannot read properties of undefined`. Same path for tools, chrome rules, `selection`, `selectionChrome`. Should detect the cycle and throw a named error.
- evidence: read
- severity: low

## `useStableToolOptions` key collides for strings containing its separators, keeping stale tool options
- where: packages/core/src/canvas/SceneCanvas/presetBuild.ts:141 (contentKeyOf)
- scenario: array elements are joined with `,` and primitives keyed as `string:<raw>` without escaping (identityKeyOf). `toolOptions={{ x: { ids: ['a', 'b'] } }}` and `{ x: { ids: ['a,string:b'] } }` both key as `{"x":{"ids":[string:a,string:b]}}`, so the memo returns the previous options object and `build` never sees the change. Object keys are JSON-escaped but primitive values are not; should JSON.stringify primitive strings.
- evidence: read
- severity: low

## `describePresets` attributes an included preset to the including package rather than the one shipping it
- where: packages/core/src/canvas/SceneCanvas/describePresets.ts:37 (visit)
- scenario: `describePresets({ editing: [presets.draw], core: [corePresets.view] })` where `draw` includes `view`: `visit(inner, pkg)` passes `'editing'`, so `view` is described as `package: 'editing'` and the later `core` entry is skipped by `seen`. The function's own contract says `sources` is "keyed by the package that ships them"; the result depends on object key order and mislabels core's preset.
- evidence: read
- severity: low

## `DevHuds.toWorld` leaves the previous view id in place when the canvas api is missing
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:47 (toWorld)
- scenario: before the canvas handle is set (or after it is cleared), `toWorld` returns the identity point but does not reset `viewIdRef`; the pick HUD then asks `pickEvery`/`pickBest` at a client-space point for whatever view the last converted point landed in. Should set `viewIdRef.current = null` on that branch.
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
