## subImageR8/subImageRGBA write glyph bytes into a texture uploadR8/uploadRGBA refused as an image's
- where: packages/renderer/src/cache/GLTextureCache.ts:167 (subImageR8), :184 (subImageRGBA)
- scenario: an image is registered (or `upload`ed) under an id a dynamic glyph page later uses, e.g. `weasel-dyn-sdf-page-0`. `uploadR8` → `claimPage` sees the id taken by a non-page, warns "only the one made first is kept", and does nothing. But `dynamicPages.sync` (packages/font/src/dynamic/dynamicPages.ts:84-98) sees `cache.has(id)` true, skips the upload and patches: `subImageR8` looks the id up through `texture(id)` with no `pages` check and calls `writeSubTexture` with w×h single-channel bytes on the RGBA8 image texture. WebGL raises INVALID_OPERATION (or WebGPU a validation error) and nothing is written, or, for `subImageRGBA`, glyph texels overwrite the image's and its mipmaps are regenerated. Expected: the collision is settled one way, as `claimPage`/`collidesWithPage` settle it: the patch methods refuse a non-page id too.
- evidence: read
- severity: low
- fix: packages/renderer/src/cache/GLTextureCache.ts
- size: line
- cause: page ownership checked on create, not on patch
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
