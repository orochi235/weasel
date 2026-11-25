# Audit round 84 — renderer.gpu findings

## WebGL `writeBuffer` with `length: 0` writes the rest of `data`, which the bounds check and WebGPU both treat as nothing
- where: packages/renderer/src/gpu/webgl/glResources.ts:78 (writeBuffer); packages/renderer/src/gpu/bufferWrite.ts:4 (bytesOf)
- scenario: `gpu.writeBuffer(buf, 0, new Float32Array(64), 16, 0)`, e.g. a caller writing a computed run that came out empty. `bytesOf` counts 0 bytes, so `checkBufferWrite` passes for any buffer. GL's `bufferSubData(target, dst, data, srcOffset, length)` reads a `length` of 0 as "to the end of the array", so it writes elements 16–63 (192 bytes) at offset 0. That overwrites bytes the caller never asked to write, or, if those bytes run past the buffer, raises a GL INVALID_VALUE error that the range check exists to replace with a throw. WebGPU's `writeBuffer` (wgpuResources.ts:100) writes the 0 bytes `bytesOf` gives it, so the two backends do different things. A zero length should write nothing: return early, as `setUniformData` already does for the same GL quirk (uniformUpload.ts:37).
- evidence: read
- severity: medium

## `GlProgram.has` answers false for a uniform array that was looked up, where WebGPU's `has` answers true
- where: packages/renderer/src/gpu/webgl/GlProgram.ts:194 (has)
- scenario: a program declares `uniform vec4 u_ripples[8]`, and the renderer looks it up with `lookupUniformArrays(new Map([['u_ripples', …]]))`. WebGL's `has('u_ripples')` checks only `this.uniforms`, so it answers false, even though `location()`/`set()` write the array through its slot-0 location and `array('u_ripples')` returns it. WebGPU's `has` (wgpuProgram.ts:213) resolves the bare member name, and a sampler array's slot `_0`, so it answers true. A caller that skips a write when `has` is false drops the array on WebGL only. `has` should also check `this.arrays`.
- evidence: read
- severity: low

## `setSampling` with an explicitly `undefined` field updates the recorded sampling, but GL keeps the old setting
- where: packages/renderer/src/gpu/webgl/glResources.ts:209 (setSampling) / :144 (applySampling)
- scenario: the texture has `mipmap: true` and a caller turns it off with `setSampling(tex, { mipmap: cond ? true : undefined })`. `next = { ...was, ...sampling }` records `mipmap: undefined`, which counts as off, so the change check passes. `applySampling` then computes `sampling.mipmap ?? was.mipmap`, which is `true`, and sees no change, so `TEXTURE_MIN_FILTER` stays `LINEAR_MIPMAP_LINEAR` while `texture.sampling` says mipmapping is off. A later identical call returns early, so GL and the record stay out of step. An explicit `min: undefined` does the same and leaves `sampling.min` undefined. `applySampling` should diff against the merged `next`, not fall back from `sampling` to `was`.
- evidence: read
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
