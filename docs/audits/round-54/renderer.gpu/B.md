I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole findings document is below instead. One discrepancy you should know about: the checkout is at `830b463cc1`, not the frozen commit `608f35f` the brief names, and it has uncommitted changes. None of those changes are in this area's files. Line numbers are from this working tree.

## WebGPU programs keep block members in one flat name table, so a group-1 struct member that shares a kit member's name takes the kit's writes
- where: packages/renderer/src/gpu/webgpu/wgpuProgram.ts:122-123 (WgpuProgram constructor), :167-169 (resolve)
- scenario: `this.members.set(m.name, …)` puts the members of every uniform block into one map, keyed by bare member name, and the last one wins. Bindings come in source order, so the prelude's group-0 kit struct comes first and the program's own group-1 struct second. Take a custom WGSL effect whose own `Params` struct has a member named `resolution`, `texel` or `windowOrigin`, or a custom program whose struct has `bounds`, `view`, `proj` or `worldOrigin`, or a paint kind's with `model`, `origin` or `worldInv`. The kit's `set('u_resolution', …)` (or `u_bounds`, and so on) goes through `ALIASES` to that name and lands in the program's own struct. Two things break: `kit.resolution` (or `kit.bounds`) stays 0, so a custom program with a zero `bounds` draws a degenerate quad and nothing appears; and the program's own value is overwritten by the kit's. WGSL allows the same member name in two structs, and GLSL has no such collision. The table should be keyed per block, or the kit's names resolved against the kit block only.
- evidence: read
- severity: medium

## A throw inside a premultiplied WebGL image upload leaves UNPACK_PREMULTIPLY_ALPHA_WEBGL on, so every later upload is premultiplied
- where: packages/renderer/src/gpu/webgl/glResources.ts:117-121 (upload)
- scenario: `createTexture` or `writeTexture` is called with `{ source, premultiply: true }`, and `texImage2D` throws (a cross-origin `HTMLImageElement` throws SecurityError) or the scratch canvas's `drawImage` throws (a closed `ImageBitmap` throws InvalidStateError). The flag set on line 117 is never put back, because there is no `try/finally`. Nothing else resets it either: the `premultiply: false` branch (line 114) and the typed-array branches never set it, and `beginFrame` doesn't touch it. From then on, every straight-alpha image upload and every typed-array upload on that context is premultiplied, so translucent texels come out darker (font atlases sent "as held" included). The flag should be restored in a `finally`, or set explicitly on every path.
- evidence: read
- severity: medium

## WebGPU `readCanvas` turns the rect over using the canvas's current height, not the height of the texture it reads
- where: packages/renderer/src/gpu/webgpu/WebGPUDevice.ts:252-254 (readCanvas); packages/renderer/src/gpu/webgpu/wgpuTargets.ts:137 (frameTexture)
- scenario: The canvas is resized (a device-pixel-ratio change or a ResizeObserver setting `width`/`height`), then `readPixels` runs before the next frame. `frameTexture()` is still the old-size texture, but `encodeReadTexture(…, this.surface.height, rect)` flips against the new height, and `readPixels.checked` validated the rect against the new size too. When the canvas grew, the copy runs past the old texture. That is a validation error on the encoder: the read resolves to zeros, and if a pass was open, the draws encoded with it in the same submit are voided. When the canvas shrank, it reads the wrong rows. The flip should use `texture.height`, and the rect should be clamped to the texture.
- evidence: read
- severity: low

## A zero-width or zero-height canvas makes `CanvasTarget` reallocate its color, resolve and stencil textures on every view call
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:121-123 (CanvasTarget.ensure)
- scenario: The canvas is 0 wide (for example, a collapsed panel). `ensure` allocates `Math.max(1, width)` but compares against the raw `width`, so `this.color.width === width` is 1 === 0, which is never true. Each of `colorView()`, `resolveView()` and `depthView()` in `Frame.open` disposes and recreates all three textures. One pass gets attachments from three different allocations, and every pass and every mid-pass flush retires and allocates up to nine textures, even though `applyViewport` skips every draw. The comparison should use the clamped size.
- evidence: read
- severity: low

## WebGPU `writeBuffer` pads a write to 4 bytes with zeros, overwriting the bytes after it, and rejects offsets GL accepts
- where: packages/renderer/src/gpu/webgpu/wgpuResources.ts:63-73 (writeBytes), :98 (writeBuffer)
- scenario: `writeBuffer(indexBuffer, 0, uint16Indices, 0, 3)` is 6 bytes. `padded` writes 8, which zeroes the index the buffer already held at position 3; GL's `bufferSubData` writes exactly 6. `writeBuffer(buf, 2, …)`, a uint16 partial update at an odd element, is a WebGPU validation error (the offset must be a multiple of 4) and the write is dropped, where GL writes it. The `GpuDevice.writeBuffer` contract (types.ts:252) mentions neither restriction. In-tree callers write Uint32/Float32 from offset 0, so the first uint16 or offset caller is the one that hits this.
- evidence: read
- severity: low

## The doc says `GpuProgram.set`'s `offset`/`count` count elements of the array's type, but both backends read them as components
- where: packages/renderer/src/gpu/types.ts:192-194; packages/renderer/src/gpu/webgl/uniformUpload.ts:36 (setUniformData); packages/renderer/src/gpu/webgpu/wgpuProgram.ts:229-231 (WgpuProgram.set)
- scenario: Following the doc, `set('u_ripples', 'vec4', data, 1, 1)` should write the second vec4. GL passes `srcOffset=1, srcLength=1` to `uniform4fv`, which counts components; a length of 1 is not a multiple of 4, so it raises INVALID_VALUE and writes nothing. WebGPU slices `data[1..2]` and writes one float into `u_ripples[0].x`. Neither writes the element the doc names, and neither moves the destination slot.
- evidence: read
- severity: low

## WebGPU targets report `samples` and `bytes` from the requested sample count, not the 1× or 4× actually allocated
- where: packages/renderer/src/gpu/webgpu/wgpuTargets.ts:53-69 (createTarget)
- scenario: `createTarget({ samples: 8 })` allocates 4× MSAA, but `bytes` counts 8× and `samples` says 8. `samples: 2` counts 2× for a 4× buffer. `samples: 1` allocates a single-sampled target with a sampleable `color` while reporting `samples: 1`, but WebGL's target with `samples: 1` is multisampled with `color: null` (glTargets.ts:43). Memory budgets that read `bytes` are off by up to 2×, and the two backends disagree on whether the same desc gives a sampleable target.
- evidence: read
- severity: low

## A straight-alpha `ImageBitmap` uploaded with `premultiply: false` stays straight on WebGL but is premultiplied on WebGPU
- where: packages/renderer/src/gpu/webgpu/wgpuResources.ts:178 (upload)
- scenario: `GLTextureCache.upload` (a font atlas "sent as held") passes an `ImageBitmap` made with `premultiplyAlpha: 'none'` and `premultiply: false`. GL's `texImage2D` uploads the texels as they are, straight. WebGPU forces `premultipliedAlpha: true` for every `ImageBitmap`, so the browser premultiplies the 'none' bitmap and the RGB channels are scaled by alpha wherever alpha < 1. That corrupts a distance field or other data texture on WebGPU only. Whether such a bitmap reaches `upload` is my inference; I didn't trace an in-tree caller.
- evidence: read (the reachability is inferred)
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

<!-- done: 8 findings, files read: 47 -->