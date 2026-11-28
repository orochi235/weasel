## A glyph page refused under an image's id is still patched into that image's texture
- where: packages/renderer/src/cache/GLTextureCache.ts:177 (subImageR8), packages/renderer/src/cache/GLTextureCache.ts:194 (subImageRGBA)
- scenario: an image is uploaded (`upload`/`uploadRegistered`) under id `weasel-dyn-color-page-0`, then `PageSet.sync` (packages/font/src/dynamic/dynamicPages.ts:84) runs for that page. `cache.has(id)` is true, so sync skips `uploadRGBA` (which `claimPage` would have refused) and goes straight to the patch branch with `last = 0`, calling `subImageRGBA(id, …)` for every patch. `subImageRGBA` looks the id up with `texture(id)` and never checks `pages`, so it writes glyph texels over the image and regenerates its mipmaps; `subImageR8` writes w×h one-byte texels into an rgba8 texture, which WebGL rejects (buffer too small for RGBA) or WebGPU fails validation on. The same happens when the image comes first and `uploadR8`/`uploadRGBA` is called: `claimPage` warns and returns, and the next patch writes anyway. docs/unruled.md (2026-11-25) rules that the one made first is kept and "an image is never written over a page"; the reverse direction is not held.
- evidence: read
- severity: low
- fix: packages/renderer/src/cache/GLTextureCache.ts
- size: line
- cause: patch paths skip the page-ownership check
- confidence: likely

## A font-atlas `upload` under a registered id removes it from the sweep, so its texture outlives the registry entry
- where: packages/renderer/src/cache/GLTextureCache.ts:68 (upload)
- scenario: id `x` is drawn through `uploadRegistered` (added to `registered`), then a font atlas is uploaded under the same id with `upload`, which does `registered.delete(id)` and rewrites the texture (warned). When the texture registry later drops `x`, `sweep` never visits it, so the GPU texture lives until `free()`. Expected: the collision keeps one owner but the texture is freed once neither owner holds it.
- evidence: read
- severity: low
- size: line
- cause: ownership flag cleared rather than shared
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

<!-- done: 2 findings, files read: 11 -->
