## Glyph-outline stroke ribbons take `vertexWidths` in world units into an em-space tessellation
- where: packages/renderer/src/cache/outlineStrokeMeshCache.ts:76 (outlineStrokeMesh)
- scenario: a text group stroked with `vertexWidths` (documented in `paint.ts` as "world units, even on a `{ px }` stroke") reaches `outlineStrokeMesh` with only `width` converted to em (`sized = { ...stroke, width: emWidth }`) and the dashes scaled by the caller (`scaledDash` in `glyphOutlineMesh.ts`); `vertexWidths` go into `tessellateStroke`/`strokeToPath` unscaled, so a 2-unit taper on 100-unit text tessellates as a 2-em taper (100x too wide), and the same world widths give a different ribbon at every font size. The key serializes `vertexWidths` explicitly, so the cache treats them as supported input. They should be divided by the same em scale as `width` (or dropped for glyphs, whose per-glyph anchor count never matches the group's).
- evidence: read (paint.ts Stroke.vertexWidths doc, glyphOutlineMesh.ts callers); the resulting wrong width is inference
- severity: low

## GLTextureCache keeps one texture per id whatever the alpha convention, so a straight upload and a premultiplied one under the same id share texels
- where: packages/renderer/src/cache/GLTextureCache.ts:64 (ensure)
- scenario: font atlases (`upload`, straight) and registry textures (`uploadRegistered`, premultiplied) share one id namespace in `map`/`sources`. If a registered texture id equals a font family's id and the same source arrives through the other path, `ensure` sees `sources.get(id) === source` and writes nothing, so the texels keep the first call's convention: a registered image drawn straight (dark fringes after `STRAIGHT_RGB_GLSL` divides alpha out again), or an SDF atlas premultiplied (corrupted distance channels). With different sources, the second path overwrites the font's atlas, and `sweep` later deletes a font's texture because the id was marked registered. Ids from the two sources need separate namespaces, or `premultiply` has to be part of what `ensure` compares.
- evidence: read
- severity: low

## GLMeshCache keeps uploading after `dispose`, and what it uploads then is never freed
- where: packages/renderer/src/cache/GLMeshCache.ts:71 (handleFor), :97 (uploadTransient)
- scenario: after `dispose()` (`persistent` cleared, `disposed = true`), `map` still holds every old handle, so `handleFor(mesh)` returns geometry whose buffers were deleted (drawing it binds dead VAOs), and a miss uploads new resources into `persistent`, which no later `dispose` reaches because the `disposed` guard returns early. Any draw through a renderer after its `dispose` leaks those buffers. `dispose` should clear `map` (by swapping in a new WeakMap), or `handleFor`/`upload` should refuse once disposed.
- evidence: read; whether any caller draws after `ContextResources.dispose` is unverified
- severity: low

## GLImageCache hands out deleted textures after `dispose`
- where: packages/renderer/src/cache/GLImageCache.ts:146 (dispose), :160 (upload)
- scenario: `dispose` deletes every texture but leaves `map` (and `mipped`) populated. A later `upload(key, source)` for an already-uploaded key returns the deleted texture from `map` and binds it, and `buildMipmaps` skips it as already mipped. `setImageMinification` disposes the old cache and replaces it, so this only shows if something still holds the old instance, but `dispose` is described as freeing every texture this cache uploaded, while its lookups go on returning them.
- evidence: read; no caller found that keeps the old instance (contextResources.ts replaces it at once)
- severity: low

## Files read
packages/renderer/src/cache/GLImageCache.ts
packages/renderer/src/cache/GLMeshCache.ts
packages/renderer/src/cache/GLTextureCache.ts
packages/renderer/src/cache/GradientRampAtlas.ts
packages/renderer/src/cache/cache.ts
packages/renderer/src/cache/markerCommandCache.ts
packages/renderer/src/cache/outlineMeshCache.ts
packages/renderer/src/cache/outlineStrokeMeshCache.ts
packages/renderer/src/cache/strokeMeshCache.ts
packages/renderer/src/cache/uploadPremultiplied.ts
packages/renderer/src/cache/whiteTexture.ts

<!-- done: 4 findings, files read: 11 -->
