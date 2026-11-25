# Audit round 88 — renderer.cache (blind reviewer)

## `GLTextureCache.replaces` answers "will new pixels be written" differently from `ensure`
- where: packages/renderer/src/cache/GLTextureCache.ts:99 (replaces), vs :68 (ensure)
- scenario: `ensure` rewrites a cached texture's texels when the source differs **or** when the premultiply flag differs (`this.sources.get(id) !== source || was !== premultiply`), but `replaces` checks only the source. An id first uploaded as a font atlas via `upload(id, src)` (straight) and then drawn as a registered pattern with the same source object: `patternBatch.ts:82` asks `replaces(id, src)` → `false`, so it keeps the open batch (which may still hold a draw sampling the straight texels under that slot), then `uploadRegistered` rewrites the texture premultiplied before the flush. The earlier, still-pending draw samples the new texels. `replaces` should apply the same test `ensure` does (source or premultiply mismatch), so the decision lives in one place. The case is the one `ensure` already warns about, so it is narrow.
- evidence: read
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

<!-- done: 1 findings, files read: 11 -->
