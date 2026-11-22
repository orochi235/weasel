# Audit round 69, renderer.gpu, reviewer findings

## WebGL draws go to whatever framebuffer was bound last, not the open pass's target, once anything rebinds mid-pass
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:200 (draw), with :232 (readIdsSync), :239 (readCanvasSync), packages/renderer/src/gpu/webgl/glTargets.ts:54-63 (createTarget), :121 (readIds)
- scenario: `beginPass({ target: T })` binds T's FBO once, through the cache. `draw` never binds `this.target.fbo` again; it only calls `setDrawBuffers(target.fbo, …)`, which acts on whatever draw framebuffer is bound. If the caller calls `createTarget` (binds the new FBO, then `null`), `readIdsSync`/`readIds` (binds another target) or `readCanvasSync` (binds `null`) between `beginPass` and a `draw`, the draws land in the canvas or another target. On an id target, `gl.drawBuffers([COLOR_ATTACHMENT0, …])` then hits the default framebuffer (INVALID_OPERATION), and the cache records that draw-buffer state against T's FBO even though T never received it. The WebGPU device handles exactly these calls mid-pass (`Frame.outsidePass` ends and resumes the pass), and `GpuDevice` forbids only `resolve` inside a pass, so the two backends disagree. Expected: `draw` (or `beginPass` plus every rebinding helper) keeps the pass's FBO bound, e.g. `cache.bindFramebuffer(target ? target.fbo : null)` at the top of `draw`, which costs nothing when it is unchanged.
- evidence: read
- severity: medium

## A WebGL renderer built from `canvas` opens its context without `preserveDrawingBuffer`, so `readCanvas` after the frame's task reads a cleared buffer
- where: packages/renderer/src/gpu/webgl/openWebGL.ts:12 (openWebGL)
- scenario: `GpuDevice.readCanvas` promises "the canvas's RGBA8 pixels … as the last frame left them". The WebGPU canvas target keeps a resolved copy for that reason ("as a WebGL canvas's preserved buffer does", wgpuTargets.ts:100-102). But `openWebGL` creates the context with `{ stencil: true }` only. After the browser composites, the drawing buffer is cleared, so `readPixels(gpu, rect)` called in a later task (an awaited capture, a click handler) returns transparent black on WebGL and the real pixels on WebGPU. Core's own context path sets `preserveDrawingBuffer: true` (packages/core/src/canvas/contextAttributes.ts:7); the renderer's own `canvas` path does not.
- evidence: read
- severity: medium

## A plain-typed `var<uniform>` in group 0 or 1 throws "WGSL: no struct undefined"
- where: packages/renderer/src/gpu/webgpu/wgpuProgram.ts:125-126 (WgpuProgram constructor), packages/renderer/src/gpu/webgpu/wgslReflect.ts:246
- scenario: `reflectWgsl` records a uniform binding whose type is not a struct (`@group(1) @binding(1) var<uniform> tint: vec4f;`) with `struct` unset, and its type docs describe that shape as valid ("unset for … a uniform of a plain type"). `WgpuProgram` then calls `createUniformBlock(reflection, b.struct!)` with `undefined` and throws `WGSL: no struct undefined`. That message names neither the binding nor the rule. GLSL accepts the same uniform, so a custom program ported one-for-one fails with no pointer to the cause. Expected: lay the plain type out as a one-member block, or throw naming the binding and saying uniforms must be structs.
- evidence: read
- severity: low

## WGSL reflection reads function-scope `const`s as module constants, so a local of the same name resizes a uniform array
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:201-205 (reflectWgsl)
- scenario: the `const` pattern is matched across the whole comment-stripped source, function bodies included, and `consts.set` keeps the last match. In a module with `const N = 8;` at module scope, `struct P { w: array<vec4f, N> }` bound as a uniform, and `fn f() { const N = 2; … }` later on, the block is laid out with 2 elements (32 bytes) where the shader declares 8 (128 bytes). `minBindingSize` and the bind size then fall short of what the shader reads, so the pipeline or bind group is refused, or `u_w[5]` writes are dropped as unknown names. Expected: only module-scope `const`s (brace depth 0) feed array sizes.
- evidence: read
- severity: low

## On WebGPU, replacing a target color texture's GPU texture leaves the target drawing into the retired one
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:65,73 (createTarget: `colorView` captured once), packages/renderer/src/gpu/webgpu/wgpuResources.ts:167-176 (replaceTexture), packages/renderer/src/gpu/webgpu/wgpuUtility.ts:85-90 (generateMipmaps)
- scenario: `target.color` is an ordinary `GpuTexture`, so `generateMipmaps(target.color)` (or `writeTexture` with a new size, or with `data: null`) is a legal call. On WebGPU it swaps `color.gpu` and `color.view` for a new texture and retires the old one. But the target's `colorView()` returns the view captured at creation. The next pass on the target renders into the destroyed texture (a validation error that voids the submit), while sampling `target.color` reads the new texture, which never receives those draws. On WebGL the same calls keep the texture handle and the FBO attachment, so the target keeps working. No caller in the tree does this today; it is a trap in the device contract. Expected: `colorView` reads `color.view` at call time, as `idsView` already reads `ids?.view`.
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

<!-- done: 5 findings, files read: 49 -->
