# renderer.cache findings

## A glyph page refused by `claimPage` still has its patches written into the image texture that holds its id
- where: packages/renderer/src/cache/GLTextureCache.ts:174 (subImageR8), packages/renderer/src/cache/GLTextureCache.ts:191 (subImageRGBA)
- scenario: a registered texture is uploaded under an id that a dynamic glyph page later uses (e.g. `weasel-dyn-sdf-page-0`). `uploadR8` → `claimPage` warns "only the one made first is kept" and returns without making a page. `PageSet.sync` (packages/font/src/dynamic/dynamicPages.ts:84) then sees `cache.has(id)` true and sends every later patch to `subImageR8(id, …)`, which calls `writeSubTexture(this.texture(id), …)` on the registered RGBA8 image with tightly packed one-byte-per-texel data. On GL that is a format mismatch (INVALID_OPERATION, or the image corrupted); on WebGPU `bytesPerRow` is computed from the RGBA texture's format while the buffer holds w×h bytes, so the write fails validation. `subImageRGBA` writes color-glyph texels over the image and regenerates its mipmaps. The image the warning promises to keep is overwritten or the frame errors. Once a sweep deletes the registered id, `has` turns false and the page is created, so behavior also depends on sweep timing. The patch paths should refuse an id that is not in `pages`, as the upload paths already do.
- evidence: read
- severity: low
- fix: packages/renderer/src/cache/GLTextureCache.ts
- size: line
- cause: patch paths skip the page-ownership check
- confidence: likely

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

<!-- done: 1 findings, files read: 11 -->
