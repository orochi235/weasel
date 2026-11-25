# Findings: apps.site.demos.part2

## DrapeLabDemo writes a wheel-scrubbed radius into config outside the schema's 10–600 range
- where: apps/site/demos/DrapeLabDemo.tsx:34 (DrapeTrial, createDrapePreset callback)
- scenario: mid-drag, the wheel scrubs the drape radius; `drape.ts` clamps it only to 2–4000 px (`clampRadius`) and reports it through `onRadius`, which the demo writes as `setConfig('radius', Math.round(px))`. labkit's `useTrialWrites.write` does no range check, so a long scrub stores e.g. 4000 (or 2) in a field declared `.range(10, 600)`; the Radius control shows a value past its own slider ends, and the next drag starts from it. Should clamp to the schema's range before writing.
- evidence: read (packages/path-tools/src/drape/drape.ts:22-23,50-52,61-63; packages/labkit/src/trial/useTrialWrites.ts has no clamp)
- severity: low

## EffectChartPreviewDemo makes a fresh ImageBitmap per preview slot every frame and never closes one
- where: apps/site/demos/EffectChartDemo.tsx:130 (EffectChartPreviewDemo / withPreviews); bitmaps minted in apps/site/demos/effectChartPictures.ts:144 (`transferToImageBitmap`)
- scenario: `useElapsed` re-renders every frame, `useMemo([t])` reruns `withPreviews`, and `paint` returns a new `transferToImageBitmap()` for each reached slot (~10). The previous run's bitmaps are dropped without `close()`, and none are closed on unmount. That is roughly 600 bitmaps a second left to GC, which cannot see their backing (GPU) memory. The kit's own runner (`packages/diagram/src/effect/runner/runner.ts:187-194`, `audio/livePreviews.ts:75-81`) closes a run's previews once the next one shows, and on stop; this demo, the reference for hand-built runs, skips that.
- evidence: read
- severity: medium

## FontFallbackDemo drops every holder's Georgia enrollment on unmount, and leaves one it promoted behind
- where: apps/site/demos/FontFallbackDemo.tsx:66-74 (FontFallbackDemo, enrollment effect)
- scenario: the effect ignores the release function `registerCanvasFont` returns (`packages/font/src/dynamic/dynamicAtlas.ts:112-127`, hold-counted) and guesses ownership from `isCanvasFont` instead. (a) If another mounted component registers Georgia while this demo is up, the demo's unmount calls `unregisterCanvasFont`, which deletes all of Georgia's holds (`canvasHolds.delete`), and the other component loses its enrollment. (b) Under the `'canvas'` policy with Georgia only auto-enrolled, `isCanvasFont` is true, so `enrolledHere` is false. The demo's `registerCanvasFont` then makes the enrollment explicit "for good" and never undoes it, so Georgia stays canvas-served under every policy after the demo goes. Keep the returned release and call it in cleanup.
- evidence: read
- severity: low

## GeomDemo draws each dot from its node's data, so a dragged dot stays where it started while the curve follows it
- where: apps/site/demos/GeomDemo.tsx:151-156 (GeomDemo, `layers.scene.drawOne`)
- scenario: the `{ items }` form makes each item both `pose` and `data` (`packages/core/src/core/scene/trivialScene.ts:44-50`). A move previews through pose overrides and commits a new pose, and `data` keeps the original object. `drawOne` ignores the pose argument and draws `circlePath(n.data.x + R, n.data.y + R, …)`. Dragging p1, for example, bends the curve layer, which reads poses through `worldPoses`, and updates the table, but the control dot stays drawn at its first position: the drawn handle and the point the curve bends to come apart. The next press must land on the invisible moved pose to drag it again. Should draw from the `p` (pose) argument, as ForceGraphDemo's `drawOne` does.
- evidence: read
- severity: high

## ImageDemo's image tool can never insert: the canvas lacks `insertPreset`, so its `insert` binding has no action
- where: apps/site/demos/ImageDemo.tsx:46 (ImageDemo, `features={[pickPreset, movePreset]}`)
- scenario: `useImageTool` binds an empty-space drag to `actionId: 'insert'` (`packages/editing/src/tools/image/useImageTool.tsx:53`). `insertAction` and the `insert` dep exist only through `insertPreset` (`packages/editing/src/presets/insert.ts:13-20`, whose doc says every tool that makes a node needs it on). The canvas pool is `builtinToolActions` (just `viewport.dragPan`) plus the enabled presets' `toolActions` (`packages/core/src/canvas/SceneCanvas/useSceneCanvasTools.ts:48`), and neither `pickPreset` nor `movePreset` includes `insertPreset`. So picking Image in the palette and dragging on empty space, which the demo's comment says "drop[s] another copy of this src", inserts nothing. Add `insertPreset` to the features.
- evidence: read
- severity: high

## InsertDemo's rect tool inserts nothing: the canvas has no features, so neither `insert` nor its dep is registered
- where: apps/site/demos/InsertDemo.tsx:17-22 (InsertDemo)
- scenario: `useRectTool` binds a drag to `actionId: 'insert'`. The canvas passes no `features`, so `resolveFeatures([])` enables no preset and the action pool holds only `viewport.dragPan` (`packages/core/src/canvas/SceneCanvas/presets/toolDriven.ts:7`, `useSceneCanvasTools.ts:48`). `insertAction`, `placeAction` and the `InsertDeps` component come only with `insertPreset` (`packages/editing/src/presets/insert.ts:13-20`). Since the 2026-11-16 move of the tools to `@weasel-js/editing` (670aeb3adc), and the earlier switch away from core wiring the insert dep itself (793598e0c1's removed comment), dragging on the canvas under the active rect tool makes no rect, and this is the demo whose whole subject is that insert flow. Needs `features={[insertPreset]}` (and the selection it includes).
- evidence: read
- severity: high

## Files read
apps/site/demos/DitherDemo.tsx
apps/site/demos/DrapeLabDemo.tsx
apps/site/demos/EasingsDemo.tsx
apps/site/demos/EditingSessionsDemo.tsx
apps/site/demos/EffectChartDemo.tsx
apps/site/demos/EffectsDemo.tsx
apps/site/demos/FairingLabDemo.tsx
apps/site/demos/FilletLabDemo.tsx
apps/site/demos/FilletPanel.tsx
apps/site/demos/FontFallbackDemo.tsx
apps/site/demos/ForceGraphDemo.tsx
apps/site/demos/GeomDemo.tsx
apps/site/demos/GestureGrammarDemo.tsx
apps/site/demos/GesturesDemo.tsx
apps/site/demos/HandleLockLabDemo.tsx
apps/site/demos/HandleSnapLabDemo.tsx
apps/site/demos/HistoryDemo.tsx
apps/site/demos/HudContextMenuDemo.tsx
apps/site/demos/HudDemo.tsx
apps/site/demos/HudGalleryDemo.tsx
apps/site/demos/ImageDemo.tsx
apps/site/demos/IngestionDemo.tsx
apps/site/demos/InsertDemo.tsx
apps/site/demos/Kernel3dDemo.tsx
apps/site/demos/KeymapDemo.tsx
apps/site/demos/KitSettingsDemo.tsx
apps/site/demos/KneadLabDemo.tsx
apps/site/demos/LabLoupeDemo.tsx
apps/site/demos/LassoDemo.tsx
apps/site/demos/LayerListDemo.tsx
apps/site/demos/LayeredCurveDemo.tsx
apps/site/demos/LayoutDemo.tsx
apps/site/demos/EasingsDemo.module.css (selectors only, against the TSX's class refs)
apps/site/demos/EditingSessionsDemo.module.css (selectors only)
apps/site/demos/FairingLabDemo.module.css (selectors only)
apps/site/demos/FilletLabDemo.module.css (selectors only)
apps/site/demos/FontFallbackDemo.module.css (selectors only)
apps/site/demos/ForceGraphDemo.module.css (selectors only)
apps/site/demos/GeomDemo.module.css (selectors only)
apps/site/demos/GestureGrammarDemo.module.css (selectors only)
apps/site/demos/HandleLockLabDemo.module.css (selectors only)
apps/site/demos/HistoryDemo.module.css (selectors, and the stack rules)
apps/site/demos/Kernel3dDemo.module.css (selectors only)
apps/site/demos/KeymapDemo.module.css (selectors only)
apps/site/demos/KitSettingsDemo.module.css (selectors only)
apps/site/demos/LassoDemo.module.css (selectors only)
apps/site/demos/LayerListDemo.module.css (selectors only)
apps/site/demos/LayeredCurveDemo.module.css (selectors only)
apps/site/demos/LayoutDemo.module.css (selectors only)

<!-- done: 6 findings, files read: 49 -->
