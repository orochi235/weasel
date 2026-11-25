# Audit round 71, renderer.gpu: blind reviewer findings

## WebGL draws a program whose texture was deleted by sampling whatever its unit last held; WebGPU samples the dummy
- where: packages/renderer/src/gpu/webgl/glCache.ts:191 (bindTextures), packages/renderer/src/gpu/webgl/glResources.ts:203 (deleteTexture)
- scenario: program P calls `setTexture('u_sampler', T)`, then T is freed with `deleteTexture(T)` (or `deleteTarget` of a target whose `color` P samples). P keeps T in `GlProgram.textures`, since a program holds a texture until it is set again. `forgetTexture` marks T's unit unknown, so the next `draw` with P runs `gl.bindTexture(TEXTURE_2D, T.handle)` on a deleted object. WebGL2 rejects that bind with INVALID_OPERATION and leaves the unit as it was: either empty, after GL's own unbind on delete, or holding a texture that another program's draw bound to that unit since. P then samples that unrelated texture, and the cache records the unit as holding T, so the next bind of T to that unit is skipped too. WebGPU handles the same sequence on purpose (commit 51b6d6bfda, `WgpuTexture.deleted` → `boundTextures` binds `dummyTexture`). Two backends give two answers to the same call. GL should bind null (or a 1×1 dummy) for a texture whose handle was freed.
- evidence: read
- severity: medium

## A texture the pass draws into samples opaque black on WebGL and transparent black on WebGPU, though the GL comment says it matches WebGPU
- where: packages/renderer/src/gpu/webgl/WebGLDevice.ts:224 (draw), packages/renderer/src/gpu/webgl/glCache.ts:198; packages/renderer/src/gpu/webgpu/wgpuProgram.ts:295 (boundTextures), packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:63 (dummyTexture)
- scenario: a draw samples a texture that is `color` or `ids` of the target the open pass draws into. GL leaves that unit empty (`tex = null`). Under the GLES 3.0 rules WebGL2 follows, sampling texture 0, which is incomplete, returns (0, 0, 0, 1). WebGPU binds `dummyTexture`, a 1×1 texel of `new Uint8Array(4)`, which samples (0, 0, 0, 0). A premultiplied composite or effect reading such a source puts opaque black over the destination on WebGL and nothing on WebGPU. The comment at WebGLDevice.ts:224 ("reads as unset, as on WebGPU") says the two backends agree, and they don't. One of them should change, for example GL binding a transparent 1×1 texture instead of null.
- evidence: read (the GL incomplete-texture value is from the GLES 3.0 / WebGL2 spec, not something I ran)
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

<!-- done: 2 findings, files read: 50 -->
