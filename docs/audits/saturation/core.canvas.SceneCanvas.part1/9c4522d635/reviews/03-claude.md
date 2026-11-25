# Findings: core.canvas.SceneCanvas.part1

## Two presets that refine each other crash any keyed merge with a TypeError instead of a preset error
- where: packages/core/src/canvas/SceneCanvas/presetMerge.ts:45 (mergeByKey), reached from features.ts:236 (resolveFeatures → layers / oneOf) and presetBuild.ts:131
- scenario: preset A has `refines: ['B']`, preset B has `refines: ['A']`, and both give one layer slot (or one tool id, chrome rule, `selection` factory) different values. `resolveFeatures` records direct A→B and B→A, so `refines(A,B)` and `refines(B,A)` are both true. The conflict check passes (each refines the other), then `all.find((g) => !all.some((o) => o.value !== g.value && refines(o.preset, g.preset)))` finds no winner, and the non-null assertion `!` lets `top.value` throw `TypeError: Cannot read properties of undefined`. It should either reject the cycle in `resolveFeatures` with a `[SceneCanvas]` error naming both presets, or fall back to the conflict error.
- evidence: read
- severity: medium

## describePresets silently drops a second, different preset that shares an id, where the canvas throws
- where: packages/core/src/canvas/SceneCanvas/describePresets.ts:31 (describePresets, `seen` keyed by `p.id`)
- scenario: two packages each ship a different preset object with id `"grid"`. `resolveFeatures` throws `two different presets have the id "grid"` for them, but `describePresets` keys `seen` by id rather than by object. It lists only the first package's preset and skips the second without a word, so the description reports a preset set that can't actually be mounted together. The doc comment only covers the same preset being reached twice.
- evidence: read
- severity: low

## An insert preview loses precision far from the origin
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:32 (insertPreviewCommands, `toScreen`) and :97 (anchor dot through `worldToScreen`)
- scenario: the world→screen affine is `[scale, 0, 0, scale, -view.x*scale, -view.y*scale]`, so each screen coordinate is `world*scale + pan`, and two large terms cancel. At world x ≈ 1e12 under zoom 1e3 both terms are ≈ 1e15, where a double resolves only about 0.125 px. The outline, its copies and the anchor dot then jitter or snap off the drag, while subtracting first, `(world − view.x) * scale`, stays exact.
- evidence: read (magnitudes inferred)
- severity: low

## The pick HUD keeps asking a stale view once the canvas api is gone
- where: packages/core/src/canvas/SceneCanvas/DevHuds.tsx:47 (DevHuds `toWorld`)
- scenario: when `canvasApiRef.current` is null (before mount, or after the surface is torn down under `paintInto`), `toWorld` returns client coordinates without resetting `viewIdRef`. The next `pickEvery` / `pickBest` then picks those raw client coordinates in whichever view the last converted point landed in, not in the surface's own (`null`).
- evidence: read
- severity: low

## A frame hook shared by two contributions has its second failure swallowed silently
- where: packages/core/src/canvas/SceneCanvas/contributionFrameHooks.ts:31 (runContributionFrameHooks)
- scenario: two contributions with different ids register one hook function, say a shared `afterPaint` helper. When the hook throws for both, `reported` is keyed by the function, so only the first entry's id is ever logged and the second contribution fails with no report. Keying on the entry and phase would report each one.
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
