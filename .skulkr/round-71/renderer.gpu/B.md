# Audit round 71 — renderer.gpu findings

## `GlProgram.ready()` answers false forever on a lost (or restored) context, so `programsReady()` and `warmPrograms`' poll never finish
- where: packages/renderer/src/gpu/webgl/GlProgram.ts:106 (GlProgram.ready)
- scenario: a renderer compiling in the background (`completionStatus !== null`) whose context is lost before its programs settle. `getProgramParameter(handle, COMPLETION_STATUS_KHR)` on a lost context returns `null`, so `!== true` holds and `ready()` returns false on every call; it never reaches `settle()`, which is the path that knows a lost context answers every status as failed (line 126). `renderer.programsReady()` (contextResources.ts:89), which the changeset tells hosts to hold their first frame on, then stays false for good, and `warmPrograms`' poll (warmPrograms.ts:40) reschedules a 50 ms `setTimeout` forever on its own throwaway context — the oldest context on the page, the first a browser evicts. After a restore it stays wrong too: `webglDevice` is keyed by the `gl` object, which survives restore, so the device keeps the `COMPLETION_STATUS_KHR` it read before the loss, while WebGL requires extensions to be re-enabled with `getExtension` after a restore; until they are, the query is INVALID_ENUM, answered `null`, and `ready()` is false again. `ready()` should treat `gl.isContextLost()` (and a `null` answer) as settled.
- evidence: read (lost-context and post-restore extension behavior from the WebGL spec; not run)
- severity: medium

## GL `setTexture` writes an out-of-range sampler-array index into another sampler's unit; WebGPU ignores it
- where: packages/renderer/src/gpu/webgl/GlProgram.ts:244 (GlProgram.setTexture)
- scenario: a program with `uniform sampler2D u_a[2]; uniform sampler2D u_b;` sets `u_a` (units 0–1) then `u_b` (unit 2). A later `setTexture('u_a', tex, 2)` (or `setTexture('u_b', tex, 1)` on a non-array sampler) writes `textures[base + index]` with no check against the array's size, so it replaces `u_b`'s texture (or appends a unit nothing samples, shifting nothing but growing `textures`). On WebGPU the same call resolves `textureName('u_a', 2)` → `u_a_2`, which does not exist, and is ignored. The two backends answer one call two ways; GL silently samples the wrong texture for `u_b`.
- evidence: read
- severity: low

## WebGPU resolve/copy does not clip to either target the way GL's blit does, so an out-of-bounds rect voids the whole submit
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:191 (encodeResolve)
- scenario: `device.resolve(source, dest, w, h, x, y)` with `x + w > dest.width` or `y + h > dest.height` (or `w/h` larger than the source). GL's `blitFramebuffer` (glTargets.ts:112) clips silently to both framebuffers and draws the part that fits. WebGPU's `copyTextureToTexture` with an extent past either texture is a validation error, which invalidates the command buffer, so every draw encoded alongside it in that submit is lost. Also `origin: [0, source.height - height]` goes negative when `height > source.height`. The layer's contract (`types.ts` `resolve`) states no bounds requirement, so a caller written against GL behavior breaks only on WebGPU.
- evidence: read (GL clip behavior and WebGPU copy validation from the specs)
- severity: medium

## GL `writeTexture` that resizes a mipmapped texture leaves it mipmap-incomplete (samples black); WebGPU drops to one level and keeps drawing
- where: packages/renderer/src/gpu/webgl/glResources.ts:169 (writeTexture)
- scenario: a texture created with `sampling.mipmap: true` and `generateMipmaps` called, then `writeTexture` with an image of a different size. GL respecifies level 0 only; levels 1.. keep the old sizes, so under `LINEAR_MIPMAP_LINEAR` the texture is incomplete and samples as (0,0,0,1)/black until `generateMipmaps` runs again. WebGPU's `writeTexture` (wgpuResources.ts:209) replaces the texture with a 1-level one, and its sampler draws level 0 fine. Same call, a visible image on one backend and black on the other; the GL path should either drop the mip filter or regenerate/document that the caller must.
- evidence: read (GL completeness rule inferred from spec, not run)
- severity: low

## WebGPU `writeBuffer` accepts an unaligned write that runs past the buffer's end, which voids the submit
- where: packages/renderer/src/gpu/webgpu/wgpuResources.ts:106 (writeBuffer)
- scenario: a buffer made with 6 bytes (allocated 8). `writeBuffer(buf, 0, new Uint8Array(10))`: `bytes.byteLength % 4 !== 0` but `end (10) < buffer.size (6)` is false, so the guard passes; `writeBytes` pads to 12 and `queue.writeBuffer` writes 12 bytes into an 8-byte buffer — a validation error (device error, write dropped). GL's `bufferSubData` past the end is INVALID_VALUE and a no-op too, but the guard's message claims to catch exactly this kind of write and misses it; `end > buffer.size` is never checked.
- evidence: read
- severity: low

## `identityNdcGroups` makes a GPU buffer per call and never destroys it
- where: packages/renderer/src/gpu/webgpu/wgsl/testNdc.ts:7 (identityNdcGroups)
- scenario: each call creates a 16-byte uniform `GPUBuffer` for the identity viewport fold and hands back only the bind groups, so nothing can destroy it. A test drawing several kit modules leaves one buffer per draw on the page's shared device (`requestRendererDevice` shares one device across tests in a browser run) until the device goes away. Returning the buffer, or making it once per device, would bound it.
- evidence: read
- severity: low

## Files read
packages/renderer/src/gpu/blend.ts
packages/renderer/src/gpu/types.ts
packages/renderer/src/gpu/uniformTypes.ts
packages/renderer/src/gpu/vertexLayout.ts
packages/renderer/src/gpu/webgl/GlProgram.ts
packages/renderer/src/gpu/webgl/WebGLDevice.ts
packages/renderer/src/gpu/webgl/bitmapCanvas.ts
packages/renderer/src/gpu/webgl/contextAttributes.ts
packages/renderer/src/gpu/webgl/glCache.ts
packages/renderer/src/gpu/webgl/glResources.ts
packages/renderer/src/gpu/webgl/glTargets.ts
packages/renderer/src/gpu/webgl/openWebGL.ts
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

<!-- done: 6 findings, files read: 50 -->
