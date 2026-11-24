# Audit round 81 — apps.site.demos.part6

## visualOrder swaps adjacent same-direction pieces instead of treating them as one run
- where: apps/site/demos/shapedVisualOrder.ts:33-38 (visualOrder)
- scenario: runs are formed per piece (`pieces.map(runs)`) and never merged across piece boundaries, then the RTL-line branch reverses every run's position. An RTL line given as `[[R]], [[L1]], [[L2]]` (Hebrew word, then two separately shaped Latin strings) comes out `L2 L1 R`; bidi keeps the contiguous LTR embedding in order, so it should be `L1 L2 R`. Symmetrically, an LTR line with two consecutive RTL pieces `[[R1]], [[R2]]` comes out `rev(R1) rev(R2)` when it should be `rev(R2) rev(R1)` (the RTL embedding is reversed as a whole). The existing tests only cover the all-RTL and all-LTR multi-piece cases, where the two answers coincide.
- evidence: read
- severity: medium

## Trial clock readout shows 0.00s until the clock next moves
- where: apps/site/demos/TrialClockDemo.tsx:16-19,40 (Controls)
- scenario: the readout is seeded with the literal `0.00s` and only written from `useClockFrame`, which subscribes to `handle.onFrame` and so fires only on frames the clock moves. A trial restored from its record with a paused clock at a non-zero elapsed (or Controls remounting while paused) shows `0.00s` while the planet is drawn at, e.g., 2.30s, until Play is pressed. It should write the clock's current elapsed on mount.
- evidence: read (`useClockFrame` in packages/labkit/src/clock/hooks.ts:57-67 has no initial call; whether `onFrame` fires once on subscribe was not traced)
- severity: low

## Files read
apps/site/demos/TiledSurfaceDemo.tsx
apps/site/demos/TimelineDemo.tsx
apps/site/demos/TimelineFramesDemo.tsx
apps/site/demos/ToolReflectionDemo.module.css
apps/site/demos/ToolReflectionDemo.tsx
apps/site/demos/TransformDemo.tsx
apps/site/demos/TrialClockDemo.module.css
apps/site/demos/TrialClockDemo.tsx
apps/site/demos/TugLabDemo.tsx
apps/site/demos/TweenLabDemo.tsx
apps/site/demos/UiInputDemo.module.css
apps/site/demos/UiInputDemo.tsx
apps/site/demos/UiLogicDemo.module.css
apps/site/demos/UiLogicDemo.tsx
apps/site/demos/VertexColorAnimationDemo.tsx
apps/site/demos/ViewportDemo.tsx
apps/site/demos/WhiteboardDemo.tsx
apps/site/demos/animation/AnimatorWatch.tsx
apps/site/demos/animation/FlickSnapPanel.tsx
apps/site/demos/animation/cardEffects.ts
apps/site/demos/curveLab/ReadoutHud.tsx
apps/site/demos/curveLab/RepresentationPanel.tsx
apps/site/demos/curveLab/curveScene.ts
apps/site/demos/curveLab/overlays.ts
apps/site/demos/curveLab/presets.ts
apps/site/demos/customShaderPrograms.ts
apps/site/demos/diagram/shared.ts
apps/site/demos/ditherDemoExport.ts
apps/site/demos/ditherDemoScene.ts
apps/site/demos/effectChartPictures.ts
apps/site/demos/forceGraph/graph.ts
apps/site/demos/forceGraph/overrides.ts
apps/site/demos/pathEditLabScene.ts
apps/site/demos/pathEffectLab.module.css
apps/site/demos/pathEffectLab.tsx
apps/site/demos/pathLab/pathLab.module.css
apps/site/demos/pathLab/pathLab.tsx
apps/site/demos/pinWarpSolverLab/PinWarpSolverLab.module.css
apps/site/demos/pinWarpSolverLab/SolverPanel.tsx
apps/site/demos/pinWarpSolverLab/meshLayer.ts
apps/site/demos/pinWarpSolverLab/meshModel.ts
apps/site/demos/pinWarpSolverLab/presets.ts
apps/site/demos/pinWarpSolverLab/solverTrace.ts
apps/site/demos/rotatedResize/math.ts
apps/site/demos/rotatedResize/panels.tsx
apps/site/demos/score/scoreRoll.ts
apps/site/demos/shapedVisualOrder.ts
apps/site/demos/warpLab.tsx

<!-- done: 2 findings, files read: 48 -->
