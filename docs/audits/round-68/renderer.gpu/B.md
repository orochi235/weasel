# Audit round 68 — renderer.gpu — blind reviewer findings

## A pipeline the GPU refuses, or one over a module that failed to compile, is drawn with before the refusal is known, voiding the whole submit
- where: packages/renderer/src/gpu/webgpu/wgpuPipelines.ts:82-100 (ensurePipeline); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:106-113 (constructor); packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:180-189 (draw)
- scenario: a registered WGSL program with a compile error, or a state/target combination the GPU rejects. `ensurePipeline` calls `createRenderPipeline` inside an error scope, stores the result, and returns it at once; the scope's verdict (`refusePipeline`) and the module's `getCompilationInfo` (`refused = true`) arrive only asynchronously. So the first draw (and every draw until those promises settle) does `encoder.setPipeline(invalid)`. The file's own doc says "an invalid pipeline set on a pass voids the whole submit": that frame's every other draw — the whole scene beside the one bad program — is lost, and a pass that flushes mid-frame loses that whole submit. It should not encode a draw with a pipeline whose validity is not yet known (e.g. `createRenderPipelineAsync`, or skip the draw until the scope resolves).
- evidence: read
- severity: medium

## A GL program deleted before it settles leaks both of its shader objects
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:89-93 (deleteProgram); packages/renderer/src/gpu/webgl/GlProgram.ts:45,73,107-123 (stages / settle)
- scenario: with `KHR_parallel_shader_compile`, a program is created (e.g. warmed in the background) and then deleted — renderer disposed, program re-registered — before anything called `settle`. The shaders are only flagged for deletion inside `settle`; `deleteProgram` calls `gl.deleteProgram(handle)` directly, which detaches the shaders but leaves them alive and unflagged, and `stages` is never read again. Each such program leaks two `WebGLShader`s for the context's life. `deleteProgram` should delete pending `stages` too.
- evidence: read
- severity: low

## WebGL `set` with `count: 0` uploads the whole rest of the array; WebGPU uploads nothing
- where: packages/renderer/src/gpu/webgl/uniformUpload.ts:34-37 (setUniformData) vs packages/renderer/src/gpu/webgpu/wgpuProgram.ts:246-254 (set)
- scenario: `program.set(name, type, data, offset, 0)`. GL's `uniform*v(loc, data, srcOffset, srcLength)` treats `srcLength === 0` as "everything from srcOffset", so the GL backend writes all of `data` from `offset`; the WebGPU backend slices `[from, from + 0)` and writes nothing. `GpuProgram.set` documents `count` as a count of numbers, so the GL answer is wrong (e.g. `flushBatch.uploadHulls` with `staged.hullPlanes === 0` would push the whole stale `HULL_PLANES` pool on GL). A zero count should return without a call.
- evidence: read
- severity: low

## `samples: 1` makes a multisampled, colorless target on WebGL and a single-sampled one with a color texture on WebGPU
- where: packages/renderer/src/gpu/webgl/glTargets.ts:42-47 (createTarget) vs packages/renderer/src/gpu/webgpu/wgpuTargets.ts:54-57 (createTarget)
- scenario: `createTarget({ width, height, samples: 1 })`. GL tests `samples > 0`: it makes a 1-sample multisampled renderbuffer, `target.color` is `null`, `target.samples` is 1, and the target can only be resolved, never sampled. WebGPU tests `> 1`: a single-sampled target with a color texture and `samples: 0`. The same desc answers "can this target be sampled" two ways; a caller deriving `samples` from a device's reported count (GL's `SAMPLES` may be 1 on some contexts) gets a null `color` on WebGL only.
- evidence: read
- severity: low

## A null adapter after a device loss is cached for the page's life, so WebGPU never comes back
- where: packages/renderer/src/gpu/webgpu/requestRendererDevice.ts:9-28 (requestRendererDevice / open)
- scenario: the shared device is lost → `shared = null` → the next call runs `open()`, where `requestAdapter()` resolves `null` (the usual answer while the GPU process restarts). `open` returns `null` without throwing, so the `.catch` that forgets a failed request never runs and `shared` stays a resolved `Promise<null>`: every later call answers "WebGPU unavailable" forever, though the doc says a lost device or failed request "is forgotten, so the next call asks again". A `null` adapter (or device) should also clear `shared`.
- evidence: read
- severity: low

## WebGL readbacks run under pack state another tenant of the context may have left set
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:58-78 (beginFrame), 231-237 (readCanvasSync); packages/renderer/src/gpu/webgl/glTargets.ts:117-124 (readIds)
- scenario: `beginFrame` resets every unpack setting because "another user of the context may leave [it] set", but resets nothing on the pack side. A shared context whose other user leaves a `PIXEL_PACK_BUFFER` bound makes `readPixels(..., Uint8Array)` an INVALID_OPERATION, so `readCanvas`/`readIds` silently return zeros (picking misses everything); a left `PACK_ROW_LENGTH`/`PACK_SKIP_*`/`PACK_ALIGNMENT` writes texels at the wrong offsets or past the array. The same reasoning that resets unpack state applies to pack state before a read.
- evidence: read
- severity: low

## Files read
packages/renderer/src/gpu/blend.ts
packages/renderer/src/gpu/types.ts
packages/renderer/src/gpu/uniformTypes.ts
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
packages/renderer/src/gpu/webgpu/wgslReflect.ts
packages/renderer/src/gpu/webgpu/wgslUniforms.ts

<!-- done: 6 findings, files read: 47 -->
