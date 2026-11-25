# Audit round 70 — renderer.gpu — blind reviewer findings

## A WebGPU draw binds a texture destroyed since a program last had it set, so one stale uniform voids the whole submit
- where: packages/renderer/src/gpu/webgpu/wgpuProgram.ts:290 (boundTextures), packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:138 (deleteTexture), :193-197 (draw)
- scenario: a custom shader program holds a texture uniform (`setUniform` → `program.setTexture(name, tex)`, customShader.ts:48/60), which the program keeps "until set again". The texture is then freed (`deleteTexture` retires its `GPUTexture`, destroyed at the next `flush`), and a later draw of that program does not name that uniform. `boundTextures` still returns the freed `WgpuTexture` (it only substitutes the dummy for `null` or pass-attached textures), `bindGroup` builds or reuses a bind group over its destroyed view, and `queue.submit` rejects the whole command buffer: every draw in that encoder, not just this one, is lost. The batch avoids this only because flushBatch.ts:75-79 names every slot each flush; nothing in the device protects any other program. GL binds the deleted handle (an INVALID_OPERATION on that one bind) and the frame survives. Should: a texture whose `gpu` has been retired reads as unset (dummy), e.g. by tracking deletion on the `WgpuTexture` and checking it in `boundTextures`.
- evidence: read
- severity: medium

## WebGPU `createTarget` makes the multisampled color and stencil textures at the raw size while the color texture is clamped to 1×1
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:58-64 (createTarget), :177 (encodeResolve)
- scenario: `createTarget({ width: 0, height: 10, stencil: true })` (or `samples: 4`), e.g. a group or tile whose rounded bounds are empty. The color goes through `gpuTexture`, which clamps to `Math.max(1, …)` (wgpuResources.ts:149), but `msaa`, `depth` and the later `resolved` texture are created with `size: [width, height]` unclamped, so they are invalid textures (a WebGPU validation error), and a pass opened over the target fails validation, voiding the submit that holds it. Even where it doesn't fail, the color (1×1) and depth (0×N) attachments differ in size. `CanvasTarget.ensure` clamps all three for exactly this reason (line 121); offscreen targets don't. GL's `renderbufferStorage` with a 0 dimension is valid and voids nothing.
- evidence: read
- severity: low

## The GL backend draws a program sampling the pass's own target, which WebGPU replaces with the dummy texture
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:166 (beginPass), :221 (draw); compare packages/renderer/src/gpu/webgpu/wgpuProgram.ts:295 and wgpuTargets.ts:67 (`attached`)
- scenario: a program last given target T's color or ids texture (`setTexture('u_source', T.color)`, or `u_ids` = T.ids) draws in a pass into T. WebGPU treats both of T's textures as `attached` and binds the dummy instead, so the draw goes ahead. GL's `beginPass` unbinds only `target.color` (never `target.ids`) from the cache's units, and `draw` then calls `bindTextures(program.textures)`, which binds the program's texture right back. WebGL2 reports a feedback loop (INVALID_OPERATION) and drops the draw. The same `GpuDrawState` gives different output on the two backends, and the GL unbind protects nothing, because the program's own list overrides it.
- evidence: read
- severity: low

## `@group`/`@binding` are read only as bare decimal literals, so a binding written with a const (or `@binding( 0 )`) is silently dropped from the layout
- where: packages/renderer/src/gpu/webgpu/wgslReflect.ts:275-277 (reflectWgsl); likewise wgslEntries.ts:21 (`@location`)
- scenario: `const TEX = 1; @group(1) @binding(TEX) var t: texture_2d<f32>;` is valid WGSL. `/@binding\((\d+)\)/` fails to match, the `continue` skips the variable, and the program's bind group layout lacks it, so `createRenderPipeline` fails ("binding not in layout") and the program is `refused` and draws nothing, with an error that names the pipeline rather than the unread attribute. The same file reads `@align`/`@size` through `attributeInt`, which accepts module-scope consts and reports what it could not read (line 127). A `@location(N)` written with a const or spaces in wgslEntries is missed the same way: `attribute()` answers `undefined` and the missing-input default buffer isn't added. Should: read these through `attributeInt` (consts, hex, whitespace), and throw where one can't be read rather than skip.
- evidence: read
- severity: low

## `beginFrame` leaves WebGLSampler objects a context sharer bound, overriding the kit textures' filter and wrap
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:61-87 (beginFrame)
- scenario: the device is shared per context (`webglDevice` is a `createPart`) and `beginFrame` exists to reset what "another user of the context may leave set": blend, masks, VAO, unpack state. Another user that calls `gl.bindSampler(unit, s)` and leaves it bound overrides, on that unit, the texture parameters the kit set with `texParameteri` (glResources.ts:142-157). Kit textures bound there sample with the foreign min/mag/wrap: pixel-art images turn linear, repeat patterns clamp. Should: `gl.bindSampler(u, null)` for the units the frame binds, as the unpack state is reset.
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

<!-- done: 5 findings, files read: 50 -->
