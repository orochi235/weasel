# Audit round 72 — renderer.gpu.webgpu (blind reviewer)

## A pipeline the GPU will refuse is set on the pass before the refusal arrives, voiding the whole submit
- where: packages/renderer/src/gpu/webgpu/wgpuPipelines.ts:82-100 (ensurePipeline); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:106-114 (constructor's async compile check); packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:188-192 (draw)
- scenario: a custom WGSL program that fails to compile, or whose pipeline fails validation (a binding layout the reflection got wrong, a vertex format mismatch), is drawn. `ensurePipeline` pushes an error scope, calls the synchronous `createRenderPipeline`, caches and returns the (invalid) pipeline at once; `popErrorScope` and `getCompilationInfo` resolve only later, so `refused` / the `null` cache entry are not set yet. `draw` calls `encoder.setPipeline(invalid)`, which invalidates the command encoder, and `queue.submit` of that encoder is rejected — every other draw of the frame (and of every submit until the promises resolve) is lost, not just the bad program's. The function's own doc says "an invalid pipeline set on a pass voids the whole submit", which is exactly what the first draw(s) do. Expected: the bad program draws nothing and the rest of the frame draws (e.g. `createRenderPipelineAsync` and skip until it resolves, or gate first use on the compile info).
- evidence: read
- severity: medium

## Reflection binds every non-sampler handle type as a filtering float `texture_2d`, and every sampler as `filtering`
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:257-260 (reflectWgsl kind); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:328-334 (layoutEntry)
- scenario: a custom/effect WGSL program declares `texture_2d<u32>`, `texture_2d<i32>`, `texture_depth_2d`, `texture_2d_array<f32>`, `texture_cube<f32>`, `texture_3d<f32>`, `texture_multisampled_2d<f32>` or `sampler_comparison`. `kind` falls to `'texture'` (or `'sampler'`) by elimination and `layoutEntry` always emits `{ texture: { sampleType: 'float' } }` (default dimension 2d) / `{ sampler: { type: 'filtering' } }`, so the explicit layout does not match the module and the pipeline is refused with a GPU validation message (and, per the finding above, voids the frame it is first drawn in). A `texture_storage_2d<…>` binding likewise becomes a sampled texture instead of hitting the kit's own "storage, which the kit does not bind" error at line 143. Expected: an unsupported handle type is refused at reflection with a message naming it, as storage buffers are, or laid out by its declared type.
- evidence: read
- severity: low

## `set('u_arr[i]', …)` with more than one element's numbers writes only element i, where GL writes from i onward
- where: packages/renderer/src/gpu/webgpu/wgslUniforms.ts:78-86 (slotsOf), 102-113 (set); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:186-195 (resolve)
- scenario: a caller sets an array uniform from an element location, `program.set('u_ripples[2]', 'vec4', data)` with `data` holding three vec4s. On WebGL, `uniform4fv` at the location of `u_ripples[2]` writes elements 2, 3 and 4 (GLSL ES 3.0 array-element locations take the rest of the array). On WebGPU the slot `u_ripples[2]` has the element's type, so `write` consumes 4 numbers and drops the rest; elements 3 and 4 keep stale values. The same call is answered two ways on the two backends. Expected: an element slot writes the run from that element to the array's end, as the whole-array slot already does.
- evidence: read (GL behavior from the GLSL ES spec, inferred, not run)
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
