# Audit round 68 — renderer.gpu findings

## WebGL `limits.samples` reads whatever draw framebuffer is bound, not the canvas's
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:38 (`limits.samples` getter)
- scenario: `gl.getParameter(gl.SAMPLES)` answers for the currently bound DRAW framebuffer. The comment says "read while it is bound", but nothing binds the default framebuffer first. `resolve` (glTargets.ts:110) leaves `DRAW_FRAMEBUFFER` bound to the destination target and only marks the cache unknown, and any pass into an offscreen target leaves that FBO bound after `endPass`. Several renderers share one `WebGLDevice` per context (`webglDevice` part). So a second `WeaselRenderer` built on that context after the first has resolved a tile or drawn offscreen reads the FBO's sample count, 0, in `BatchVariantPrograms` (builtinPrograms.ts:228), `RetainedSurfaces` and `TileTextures` (which read `gpu.limits.samples` in their constructors), even though the canvas is 4× multisampled. The new renderer then takes the hull-clip shader path meant for single-sampled canvases and builds single-sampled retained scratch buffers. The getter should bind the default framebuffer (through the cache) before reading.
- evidence: read (WebGLDevice.ts, glTargets.ts resolve, the constructors that read the limit); the GL behavior is from the WebGL2 spec (SAMPLES is draw-framebuffer state)
- severity: medium

## WebGL `beginFrame` leaves blend equation and rasterizer state that another tenant of the context may have set
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:58 (`beginFrame`)
- scenario: `beginFrame` exists to forget and reset what "another user of the context may have changed". It resets blendFunc, depth, cull, colorMask, VAO and unpack state. It never resets `blendEquation`, `RASTERIZER_DISCARD`, `SAMPLE_ALPHA_TO_COVERAGE`, `SAMPLE_COVERAGE` or `POLYGON_OFFSET_FILL`, and `GlCache` does not track them. A tenant that leaves `blendEquation(gl.MAX)` set turns every premultiplied "over" into a max blend. One that leaves `RASTERIZER_DISCARD` enabled makes every draw produce nothing, with no error.
- evidence: read
- severity: low

## WebGL read-backs run under whatever pack state the context holds
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:231 (`readCanvasSync`); packages/renderer/src/gpu/webgl/glTargets.ts:117 (`readIds`)
- scenario: Both call `readPixels` into an `ArrayBufferView` without unbinding `PIXEL_PACK_BUFFER` or resetting `PACK_ROW_LENGTH`, `PACK_SKIP_ROWS` or `PACK_SKIP_PIXELS`, and `beginFrame` resets only the unpack side. If another user of a shared context leaves a pack buffer bound, `readPixels` into client memory is an INVALID_OPERATION, so `pickAt` and `readCanvas` get all-zero bytes. A non-zero row length or skip writes the rows at the wrong offsets.
- evidence: read
- severity: low

## WebGL `readIds` on a target without ids returns its color bytes; WebGPU returns zeros
- where: packages/renderer/src/gpu/webgl/glTargets.ts:117 (`readIds`); compare packages/renderer/src/gpu/webgpu/wgpuTargets.ts:198 (`encodeReadIds`)
- scenario: On a target made without `ids`, `gl.readBuffer(gl.COLOR_ATTACHMENT1)` is an INVALID_OPERATION and the read buffer stays `COLOR_ATTACHMENT0`. `readPixels` then returns the color texels as if they were pick ids, so any opaque pixel decodes as some id. The WebGPU backend answers the same call with zeros, meaning "no id". One question gets two answers, and the GL one is a false hit.
- evidence: read
- severity: low

## `stride: 0` means two different layouts on the two backends when a buffer has several attributes
- where: packages/renderer/src/gpu/webgl/glResources.ts:80 (`createGeometry`); compare packages/renderer/src/gpu/webgpu/wgpuResources.ts:116-118
- scenario: `GpuVertexBufferLayout.stride` documents 0 as "tightly packed". WebGPU turns 0 into one interleaved stride covering every attribute (`max(offset + 4·components)`). WebGL passes 0 straight to `vertexAttribPointer`, where it means each attribute is packed by itself at its own size. Take a buffer with `a` vec2 at offset 0 and `b` vec4 at offset 8, stride 0. WebGPU reads 24-byte interleaved vertices. WebGL reads `a` every 8 bytes and `b` every 16, so both attributes are wrong from the second vertex on. Today's callers pass one attribute per stride-0 buffer, so the difference stays hidden.
- evidence: read
- severity: low

## A multisampled target with ids cannot be drawn into on either backend, and `GpuTargetDesc` allows it
- where: packages/renderer/src/gpu/webgl/glTargets.ts:43-58 (`createTarget`); packages/renderer/src/gpu/webgpu/wgpuTargets.ts:56-62 and wgpuFrame.ts:161
- scenario: `createTarget({ samples: 4, ids: true })` gives WebGL a 4-sample color renderbuffer beside a single-sampled ids texture. The framebuffer is then FRAMEBUFFER_INCOMPLETE_MULTISAMPLE and every draw and clear into it fails. WebGPU begins a pass whose two color attachments have sample counts 4 and 1, which is a validation error that voids the submit. Neither backend refuses the combination or documents it as unsupported.
- evidence: read
- severity: low

## Decoded-image upload into an `r8` texture is RGBA on WebGL and red-only on WebGPU
- where: packages/renderer/src/gpu/webgl/glResources.ts:112-116 (`upload`)
- scenario: For `{ source }` data, the GL path always calls `texImage2D(..., gl.RGBA, gl.RGBA, ...)` and ignores `format`, so `createTexture('r8', …, { source })` makes an RGBA texture recorded as `format: 'r8'`. A later `writeSubTexture` on it then uploads `RED` texels into an RGBA level, which is an INVALID_OPERATION, and nothing is written. WebGPU makes an `r8unorm` texture and copies the red channel.
- evidence: read
- severity: low

## WebGPU premultiplies every ImageBitmap even when the caller asked for straight texels
- where: packages/renderer/src/gpu/webgpu/wgpuResources.ts:183 (`upload`)
- scenario: `premultipliedAlpha` is forced on for any `ImageBitmap`, whatever `data.premultiply` says. For a bitmap made with `premultiplyAlpha: 'none'` and uploaded with `premultiply: false`, WebGL's `texImage2D` keeps the straight texels as the bitmap holds them, while WebGPU writes them premultiplied. Shaders that treat the texture as straight then darken semi-transparent pixels on WebGPU only. The comment's premise, that a bitmap holds premultiplied texels, is true only of default-option bitmaps.
- evidence: read
- severity: low

## WGSL reflection strips comments as if they could not nest, and reads no hex constants
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:49 (`stripComments`), :101 (`intLiteral`), :209 (`const` token); the same strip in packages/renderer/src/gpu/webgpu/wgslEntries.ts:17 and wgsl/customPrelude.ts:72
- scenario: WGSL block comments nest, but the non-greedy `/\*[\s\S]*?\*/` ends at the first `*/`. In registered program source such as `/* old: /* note */ @group(1) @binding(0) var<uniform> p: Old; */`, the text after the inner close is reflected as live code. That adds a phantom binding, a duplicate binding number fails `createBindGroupLayout`, or an "unknown struct" error refuses the program. Separately, `const N = 0x10;` (or `0x10u`) never matches the const pattern, and `intLiteral` rejects hex, so `array<vec4f, N>` and `array<vec4f, 0x10>` throw "unknown array size" for valid WGSL.
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

<!-- done: 9 findings, files read: 47 -->
