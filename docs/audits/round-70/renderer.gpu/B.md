# renderer.gpu — blind review, round 70

## A lost WebGL context is reported as a shader compile failure, and the program keeps that failure for good
- where: packages/renderer/src/gpu/webgl/GlProgram.ts:103 (ready), :115 (settle)
- scenario: a program is created with `KHR_parallel_shader_compile` available, and the context is lost before the program is first used. On a lost context `getProgramParameter(handle, COMPLETION_STATUS_KHR)` answers `true` (the extension says so, so pollers stop waiting), so `ready()` calls `settle()`. There `getShaderParameter(sh, COMPILE_STATUS)` answers `null`, `!null` is true, and the program throws `ShaderCompileError('vertex', '')` (the info log is null, so the log is empty), stores it in `this.failure`, and calls `deleteProgram`. Every later `settle`/`has`/`set*`/`draw` rethrows that compile error. A valid shader gets reported as one that failed to compile, with an empty log, because the context went away. It should be treated as context loss (check `gl.isContextLost()` before deciding the compile failed), not cached as a source failure.
- evidence: read
- severity: low

## WebGPU `createTarget` clamps the color texture to 1×1 but makes the multisampled color and the stencil at the size asked for, so a zero-sized target is an invalid texture that voids its submit
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:57-64 (createTarget); packages/renderer/src/gpu/webgpu/wgpuResources.ts:149 (gpuTexture)
- scenario: `createTarget({ width: 0, height: h, stencil: true })` or `{ samples: 4 }`. `emptyTexture` → `gpuTexture` makes the color `Math.max(1, width)` wide, but the `msaa` and `depth` textures are made with `size: [width, height]` unclamped, which is a validation error (a texture dimension must be > 0). Opening a pass on that target puts an invalid attachment in the render pass, or, for stencil alone, attachments whose sizes differ (1×h color, 0×h depth). WebGPU then rejects the whole command buffer, along with everything else encoded into it before that pass's flush (other passes' `outsidePass` work such as resolves and mipmaps). `encodeResolve`'s `source.resolved` is unclamped too. The single-sampled color path already decided that 0 means 1; the other attachments should follow the same rule. In GL a 0-sized renderbuffer only makes that one FBO incomplete, and its draws are no-ops.
- evidence: read
- severity: low

## WebGPU canvas pass on a 0×0 canvas copies into an invalid current texture, voiding the submit
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:148-155 (CanvasTarget.finish)
- scenario: a canvas collapses to width or height 0 (a hidden or zero-sized element) while the renderer still draws a frame. `ensure()` keeps 1×1 buffers, and `applyViewport` sets `skip`, so no draw is encoded. But `close()` → `finish()` still calls `context.getCurrentTexture()`, which allocates a 0-sized texture (a validation error, so an error texture), and encodes `copyTextureToTexture` into it. The submit that flush sends then fails validation, and everything else in that encoder goes with it, including resolves, mipmaps and tile bakes that `outsidePass` encoded before the canvas pass closed. `finish` should return early when `canvas.width` or `canvas.height` is 0.
- evidence: read
- severity: low

## Files read
packages/renderer/src/gpu/blend.ts
packages/renderer/src/gpu/types.ts
packages/renderer/src/gpu/uniformTypes.ts
packages/renderer/src/gpu/vertexLayout.ts
packages/renderer/src/gpu/webgl/GlProgram.ts
packages/renderer/src/gpu/webgl/WebGLDevice.ts
packages/renderer/src/gpu/webgl/contextAttributes.ts
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

<!-- done: 3 findings, files read: 50 -->
