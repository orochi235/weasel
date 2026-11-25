## writeBuffer with `length` 0 passes the bounds check as a 0-byte write, but WebGL writes the rest of the array
- where: packages/renderer/src/gpu/webgl/glResources.ts:78 (writeBuffer), with packages/renderer/src/gpu/bufferWrite.ts:2 (bytesOf)
- scenario: `device.writeBuffer(buf, 0, new Float32Array(1024), 512, 0)` on a 64-byte buffer. `bytesOf` counts `0 * 4` bytes, so `checkBufferWrite(0, 0, 64)` passes, then `gl.bufferSubData(target, 0, data, 512, 0)` runs; WebGL2 reads a zero length as "to the end of the array", so it tries to write 2048 bytes, overflows, and is dropped with an INVALID_VALUE that nothing reports. On a buffer large enough to hold it, 2048 bytes are written where the caller asked for none. The contract says "write `length` elements", and WebGPU writes nothing for the same call, so the two backends disagree. `uniformUpload.ts` already returns early on a zero length for this exact GL quirk; `writeBuffer` should do the same.
- evidence: read
- severity: medium

## setSampling with an explicitly undefined key records state GL does not hold
- where: packages/renderer/src/gpu/webgl/glResources.ts:216 (setSampling)
- scenario: a texture sampled with `mipmap: true` gets `setSampling(tex, { min: 'linear', mipmap: opts.mipmap })` where `opts.mipmap` is undefined. `next = { ...was, ...sampling }` sets `next.mipmap` to undefined, so the change check sees a change, but `applySampling` reads `sampling.mipmap ?? was.mipmap` (true) and leaves GL at LINEAR_MIPMAP_LINEAR. `texture.sampling` is then saved with `mipmap: undefined`. A later `setSampling(tex, { mipmap: false })` compares false with `undefined ?? false`, returns early, and GL keeps mipmap filtering for good. The same applies to `min: undefined`. Merging and applying should treat an undefined key the same way: either both skip it or both use it.
- evidence: read
- severity: low

## resolve into an id target copies the color into its id attachment too
- where: packages/renderer/src/gpu/webgl/glTargets.ts:118 (resolve)
- scenario: `resolve(src, dest, …)` where `dest` was created with `ids: true`. `dest.fbo`'s draw buffers stay as `createTarget` (or the last draw) left them, usually `[COLOR_ATTACHMENT0, COLOR_ATTACHMENT1]`. `blitFramebuffer` with COLOR_BUFFER_BIT writes every enabled draw buffer, so the resolved color overwrites the pick ids in attachment 1, and `readIds` then returns color bytes as ids. `resolve` should call `setDrawBuffers(dest.fbo, 'color')` on an id target first. I found no caller that does this today; the API allows it, since `resolve` accepts any single-sampled dest.
- evidence: read (GL blit semantics; no caller verified)
- severity: low

## Files read
packages/renderer/src/gpu/blend.ts
packages/renderer/src/gpu/bufferWrite.ts
packages/renderer/src/gpu/samplerIndex.ts
packages/renderer/src/gpu/textureSize.ts
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

<!-- done: 3 findings, files read: 16 -->
