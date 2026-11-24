# Audit round 81 — apps.site.demos.part6

## scoreRoll draws an all-silent bar at full opacity, a silent note among loud ones at the floor
- where: apps/site/demos/score/scoreRoll.ts:42 (scoreRoll)
- scenario: notes whose `gain` are all 0 → `loudest` is 0, so `level` falls back to 1 and every note paints at opacity 1.0, the loudest look; the same gain-0 note in a bar with any louder note paints at 0.35. A silent note should read as the quietest in both cases (level 0), not the loudest when nothing else sounds.
- evidence: read
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

<!-- done: 1 findings, files read: 48 -->
