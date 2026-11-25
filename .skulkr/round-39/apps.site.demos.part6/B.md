# Findings: apps.site.demos.part6 (round 39)

## The Voronoi demo's WGSL program is refused on every WebGPU browser lacking `uniform_buffer_standard_layout`
- where: apps/site/demos/customShaderPrograms.ts:105 (VORONOI_WGSL, `struct Params { u_seeds: array<vec2f, 8>, … }`)
- scenario: open the custom-shader demo on a WebGPU backend whose `navigator.gpu.wgslLanguageFeatures` lacks
  `uniform_buffer_standard_layout` (Safari, Firefox, older Chrome). `array<vec2f, 8>` has an 8-byte stride; the
  renderer's `checkUniformLayout` (packages/renderer/src/gpu/webgpu/wgslReflect.ts:176–238) throws
  "uniform member … array's stride a multiple of 16 … pad it with @align/@size or a slot struct" when the program
  is built, so the Voronoi swatch never draws on that backend, while the GLSL twin works. The ripple program's
  `array<vec3f, 8>` (stride 16) passes, which shows the demo meant to stay inside the strict layout. Should use a
  16-byte-stride element (e.g. `array<vec4f, 4>` packing two seeds, or a padded slot struct).
- evidence: read
- severity: medium

## Files read
apps/site/demos/ThemeDemo.tsx
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
apps/site/demos/warpLab.tsx

<!-- done: 1 findings, files read: 47 -->
