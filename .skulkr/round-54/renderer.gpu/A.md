I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole document is below.

One note first: this tree's HEAD is `830b463cc1`, not the `608f35f` commit the brief names, so the line numbers below are for `830b463`.

# Audit round 54, area `renderer.gpu`: blind reviewer findings

## A WGSL program the GPU refuses still draws until the refusal arrives, voiding the whole pass it is first drawn in
- where: packages/renderer/src/gpu/webgpu/wgpuPipelines.ts:82-100 (ensurePipeline), packages/renderer/src/gpu/webgpu/wgpuProgram.ts:98-106 (constructor), packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:179-188 (draw)
- scenario: a registered custom or paint WGSL program has a compile error (or a pipeline of it fails validation). `refused` is set only in the `.then` of `getCompilationInfo()` / `popErrorScope()`, and both resolve asynchronously, so the draws in the frame where the program is first used (and in any later frame where it needs a new pipeline key before the promise lands) go through `encoder.setPipeline(invalidPipeline)`. An invalid object used in a render pass invalidates the encoder, so the command buffer `Frame.flush` submits fails validation and runs nothing. Every other command in that pass, the canvas's whole frame included, is lost. The file's own comment says a draw with a refused pipeline "would void every command submitted beside it", and the guard comes too late to stop that first draw. It should validate before first use (`createRenderPipelineAsync`, whose rejection arrives before the pipeline is handed out) or hold the draw until the scope resolves. Instead the canvas blanks for a frame because of one bad shader.
- evidence: read
- severity: medium

## WGSL reflection depends on declaration order, so valid modules with forward references are refused
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:209-235 (reflectWgsl), :126-132 (parseType), :94 (layoutOf); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:119 (constructor)
- scenario: WGSL module-scope declarations are order-independent, but `reflectWgsl` walks tokens in text order.
  - (a) `@group(1) @binding(0) var<uniform> params: Params;` written above `struct Params { … }`: at the `var`, `structs.has('Params')` is false, so the binding is pushed with no `struct`. `new WgpuProgram` then calls `createUniformBlock(reflection, undefined)`, which throws "WGSL: no struct undefined".
  - (b) A struct whose member is `array<f32, N>`, with `const N = 4;` declared below it, throws "unknown array size N".
  - (c) A struct holding another struct declared later becomes `unlaid` ("unsupported type"), and a uniform naming it throws.

  The browser compiles all three modules, but `createProgram` throws on each, naming the wrong problem. This differs from the ruled plain-type uniform case (`var<uniform> t: f32`, docs/unruled.md, audit round seven): there the type is a struct, just declared later.
- evidence: read
- severity: low

## `readCanvas` on WebGPU flips the rect by the canvas's current height, not the height of the texture it reads
- where: packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:250-258 (readCanvas), packages/renderer/src/gpu/webgpu/wgpuTargets.ts:201-210 (encodeReadTexture)
- scenario: the canvas is resized (height 600 → 500) after the last frame and before the next. `CanvasTarget.ensure` has not run yet, so `frameTexture()` is still the 600-tall texture, but `readCanvas` passes `this.surface.height` (500) to `topDown`. A read of the bottom 10 rows (y 0, height 10) copies texture rows 490–500, which are 100 rows above the bottom of what was drawn, so it returns those stale pixels as if they were the bottom of the canvas. If the canvas grew instead, the copy runs off the texture: it fails validation, and the voided submit takes any other commands encoded with it. GL's canvas is cleared by the resize and reads back zeros at the new size. The flip should use `texture.height`, and the rect should be clipped to the texture.
- evidence: read
- severity: low

## WebGL `beginFrame` forgets cached state but not the pixel-store and unpack-buffer state its uploads rely on
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:50-62 (beginFrame), packages/renderer/src/gpu/webgl/glResources.ts:111-133 (upload), :169-182 (writeSubTexture)
- scenario: `beginFrame` says it forgets "anything it believed about state some other user of the context may have changed", but the only pixel-store state it resets is `UNPACK_FLIP_Y_WEBGL`. A caller passing its own `gl` (`openWebGL` takes `opts.gl`) that also uploads through it can leave state behind; three.js, for one, sets this state per texture.
  - If `UNPACK_PREMULTIPLY_ALPHA_WEBGL` is left true, a `{ source, premultiply: false }` texture is uploaded premultiplied, so its alpha is applied twice in the premultiplied blend.
  - If `UNPACK_ROW_LENGTH` or `UNPACK_SKIP_ROWS`/`UNPACK_SKIP_PIXELS` are left nonzero, every typed-array `texImage2D` or `texSubImage2D` (atlases, ramps, glyph pages) reads its rows at the wrong stride.
  - If `PIXEL_UNPACK_BUFFER` is left bound, those same uploads fail with INVALID_OPERATION and the texture stays empty.
  - The r8 path also sets `UNPACK_ALIGNMENT` back to 4 unconditionally, which clobbers a co-tenant's value.
- evidence: read
- severity: low

## A zero-sized WebGPU canvas re-creates and retires all its buffers on every view lookup
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:119-134 (CanvasTarget.ensure), packages/renderer/src/gpu/webgpu/wgpuFrame.ts:152-168 (Frame.open)
- scenario: a canvas whose `width` or `height` is 0 (for example, laid out under `display: none`). `ensure` makes its textures at `max(1, …)`, so `this.color.width === width` is never true, and every call disposes the previous set and allocates a new one. `Frame.open` calls `colorView()`, `resolveView()` and `depthView()` in turn. So each pass open (including every resume after a mid-pass flush) allocates three sets of three textures, retires two sets, and builds the pass from attachments of three different sets. `frameTexture()` then answers with the last set's resolve texture, which nothing drew into, and `finish` copies that. The check should compare against the clamped size, or `ensure` should run once per open.
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

<!-- done: 5 findings, files read: 47 -->