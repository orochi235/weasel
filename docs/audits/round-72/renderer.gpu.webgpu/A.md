# Audit round 72 — renderer.gpu.webgpu (blind reviewer)

## A pipeline (or module) the GPU refuses is still drawn with until the async error scope resolves, voiding whole submits
- where: packages/renderer/src/gpu/webgpu/wgpuPipelines.ts:82 (ensurePipeline); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:107 (WgpuProgram constructor, getCompilationInfo)
- scenario: a custom WGSL program whose pipeline fails validation (a layout mismatch, a target format the fragment output cannot feed, or a module that fails to compile) is drawn in a frame beside every other shape. `ensurePipeline` creates the pipeline synchronously, stores it in `program.pipelines` and returns it. `popErrorScope()` only resolves later, so `refusePipeline` sets the key to `null` and `program.refused` too late for that draw (and for every draw until the promise settles, often several frames). `draw` calls `setPipeline` with the invalid pipeline, which invalidates the render pass encoder, so the command buffer fails at `finish()`/`submit()` and nothing in it draws: every other shape in the frame vanishes. The function's doc says it returns `null` "where the GPU refused it: an invalid pipeline set on a pass voids the whole submit", but it cannot know that before the first use. The same applies to `refused` from `getCompilationInfo`. It should stay unused until validated, for example with `createRenderPipelineAsync` and a pending state, or by skipping a pipeline whose error scope has not settled yet.
- evidence: read
- severity: medium

## Every texture binding gets sampleType 'float' and every sampler gets 'filtering', whatever the WGSL declares
- where: packages/renderer/src/gpu/webgpu/wgpuProgram.ts:332 (layoutEntry); classification in packages/renderer/src/gpu/webgpu/wgslReflect.ts:257 (reflectWgsl)
- scenario: a custom WGSL program declares `var t: texture_2d<u32>`, `texture_depth_2d`, `texture_multisampled_2d`, a storage texture (`texture_storage_2d<…>`, which has no address space, so it is classified `'texture'`), or a `sampler_comparison` (classified `'sampler'` by `/^sampler/`). The explicit bind group layout says `texture: { sampleType: 'float' }` / `sampler: { type: 'filtering' }`, so the pipeline layout is incompatible with the shader, and the pipeline fails validation. Because of the async refusal above, that also voids the frame it was first drawn in. The reflection should either derive the layout entry from the declared type (sampleType `uint`/`sint`/`depth`, `multisampled`, `storageTexture`, sampler `comparison`) or throw at `createProgram`, naming the binding the way `var<storage>` already does at wgpuProgram.ts:143.
- evidence: read
- severity: low

## The WGSL id composite does not clamp the color-matrix alpha, while the color composite now does, so ids are claimed by a different alpha than the one drawn
- where: packages/renderer/src/gpu/webgpu/wgsl/idComposite.ts:21 (ID_COMPOSITE_WGSL fs)
- scenario: an isolated group with a color matrix whose alpha row or bias pushes alpha past 1 (for example a bias of +0.5 on a source alpha of 1), `u_alpha` 0.5, and an id `minAlpha` of 0.6. `COMPOSITE_WGSL` (composite.ts:30) now `saturate`s the mapped color before multiplying by `u_alpha` (commit f9410cb72d), so the pixel is drawn at alpha 0.5. `ID_COMPOSITE_WGSL` computes `a = (matrix * src + bias).a * u_alpha` unclamped, which is 0.75 ≥ 0.6, so the group claims the pixel's id where its visible alpha is below the claim threshold. A bias pushing alpha below 0 does the reverse on the other side of the bound. The id pass should clamp as the color pass does: `saturate(...).a * u.u_alpha`. The GLSL twin (`draw/idComposite.ts:48`) has the same gap.
- evidence: read
- severity: low

## Files read
packages/renderer/src/gpu/webgpu/WebGPUDevice.ts
packages/renderer/src/gpu/webgpu/deviceLoss.ts
packages/renderer/src/gpu/webgpu/flags.ts
packages/renderer/src/gpu/webgpu/openWebGPU.ts
packages/renderer/src/gpu/webgpu/requestRendererDevice.ts
packages/renderer/src/gpu/webgpu/wgpuFrame.ts
packages/renderer/src/gpu/webgpu/wgpuPipelines.ts
packages/renderer/src/gpu/webgpu/wgpuProgram.ts
packages/renderer/src/gpu/webgpu/wgpuResources.ts
packages/renderer/src/gpu/webgpu/wgpuTargets.ts
packages/renderer/src/gpu/webgpu/wgpuUtility.ts
packages/renderer/src/gpu/webgpu/wgsl/batchFill.ts
packages/renderer/src/gpu/webgpu/wgsl/common.ts
packages/renderer/src/gpu/webgpu/wgsl/composite.ts
packages/renderer/src/gpu/webgpu/wgsl/customPrelude.ts
packages/renderer/src/gpu/webgpu/wgsl/effectPrelude.ts
packages/renderer/src/gpu/webgpu/wgsl/effects.ts
packages/renderer/src/gpu/webgpu/wgsl/glyphCell.ts
packages/renderer/src/gpu/webgpu/wgsl/glyphLayer.ts
packages/renderer/src/gpu/webgpu/wgsl/glyphPaint.ts
packages/renderer/src/gpu/webgpu/wgsl/gradFill.ts
packages/renderer/src/gpu/webgpu/wgsl/hullCoverage.ts
packages/renderer/src/gpu/webgpu/wgsl/idComposite.ts
packages/renderer/src/gpu/webgpu/wgsl/idOut.ts
packages/renderer/src/gpu/webgpu/wgsl/kitPrograms.ts
packages/renderer/src/gpu/webgpu/wgsl/meshPaint.ts
packages/renderer/src/gpu/webgpu/wgsl/ownDrawPaint.ts
packages/renderer/src/gpu/webgpu/wgsl/paintPrelude.ts
packages/renderer/src/gpu/webgpu/wgsl/paintVertex.ts
packages/renderer/src/gpu/webgpu/wgsl/pathFill.ts
packages/renderer/src/gpu/webgpu/wgsl/patternFill.ts
packages/renderer/src/gpu/webgpu/wgsl/testNdc.ts
packages/renderer/src/gpu/webgpu/wgsl/trimmedRibbon.ts
packages/renderer/src/gpu/webgpu/wgslEntries.ts
packages/renderer/src/gpu/webgpu/wgslLexical.ts
packages/renderer/src/gpu/webgpu/wgslReflect.ts
packages/renderer/src/gpu/webgpu/wgslUniforms.ts

<!-- done: 3 findings, files read: 37 -->
