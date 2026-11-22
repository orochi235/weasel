## A refused WGSL pipeline or module is drawn with before its refusal arrives, voiding the whole submit
- where: packages/renderer/src/gpu/webgpu/wgpuPipelines.ts:82 (ensurePipeline); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:106 (WgpuProgram constructor)
- scenario: a registered WGSL program whose module fails to compile, or whose pipeline the GPU rejects (an output/target mismatch, a vertex input type the default attribute cannot feed). `ensurePipeline` pushes an error scope, creates the pipeline, caches it and returns it at once; `refusePipeline` / `refused` are only set when `popErrorScope()` / `getCompilationInfo()` resolve, after the frame has already been encoded. `WebGPUDevice.draw` then calls `setPipeline` with the invalid pipeline, which invalidates the render pass encoder, so `finish()` makes an invalid command buffer and the submit is rejected: every other draw in that submit, and `CanvasTarget.finish`'s copy into the context texture, is lost. The first frame or frames that touch the broken program show nothing, where the function's own doc says it returns `null` for exactly this case so the rest of the submit survives. Fix: create with `createRenderPipelineAsync` (or wait on the scope before first use) and skip the draw until it is known valid, and check compilation before the first pipeline is made.
- evidence: read
- severity: medium

## `@align` / `@size` arguments are parsed with `Number`, so valid WGSL like `@size(16u)` or `@align(ALIGN)` lays out to NaN
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:140 (parseStruct)
- scenario: a custom program's group-1 struct declares `@size(16u) v: f32`, `@align(0x10)` or `@align(A)` with `const A = 16;`. All three are valid WGSL, but `Number('16u')`, `Number('A')` give NaN and `Number('0x10')` happens to work. The member offset and every offset after it become NaN, the struct size becomes NaN, `createUniformBlock` sizes its buffer `Math.max(16, NaN)` = NaN, and `minBindingSize: NaN` gets passed to the bind group layout. Writes through `DataView` at NaN land at byte 0. The same file already handles array counts with `wgslInt(...) ?? consts.get(...)`; the attribute arguments should be resolved the same way.
- evidence: read
- severity: low

## `beginFrame` resets `clearColor` but not `clearStencil`, so a co-tenant's clear value leaks into the renderer's stencil clears
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:61 (beginFrame); used by beginPass :176 and clearStencilBits :195
- scenario: another user of a shared WebGL2 context (the device is shared per context through `webglDevice`, and the trap doc covers labkit surfaces sharing one) calls `gl.clearStencil(1)` and leaves it set. The next frame's `beginPass({ clear: { stencil: true } })` and every `clearStencilBits(mask)` then write 1 into those bits instead of the 0 that `GpuPassDesc.clear` and `clearStencilBits` promise. Clips and even-odd fills that test `equal` against 0-based refs then cut away everything, or let everything through. `beginFrame` exists to reset such state and does reset `clearColor(0, 0, 0, 0)` for exactly this reason; `gl.clearStencil(0)` is missing beside it. WebGPU always clears to `stencilClearValue: 0` / op `zero`, so the two backends disagree.
- evidence: read
- severity: low

## Files read
packages/renderer/src/gpu/blend.ts
packages/renderer/src/gpu/types.ts
packages/renderer/src/gpu/uniformTypes.ts
packages/renderer/src/gpu/vertexLayout.ts
packages/renderer/src/gpu/webgl/GlProgram.ts
packages/renderer/src/gpu/webgl/WebGLDevice.ts
packages/renderer/src/gpu/webgl/glCache.ts
packages/renderer/src/gpu/webgl/glResources.ts
packages/renderer/src/gpu/webgl/glTargets.ts
packages/renderer/src/gpu/webgl/openWebGL.ts
packages/renderer/src/gpu/webgl/premultipliedBitmap.ts
packages/renderer/src/gpu/webgl/uniformUpload.ts
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

<!-- done: 3 findings, files read: 49 -->
