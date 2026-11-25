# Audit round 88 — renderer.cache — reviewer findings

## Marker head cache key conflates a bare marker key ending in `@` with a sized ref of the same stem
- where: packages/renderer/src/cache/markerCommandCache.ts:57 (refKey), used by the key at :101-113 (cachedMarkerHeads)
- scenario: `registerMarker('tip@', …)` and `registerMarker('tip', …)`, both declaring `reads` over the same fields. A stroke on one path draws with `markerEnd: 'tip@'`, then (same path, same width, no registry change in between) with `markerEnd: { key: 'tip' }`. `refKey('tip@')` and `refKey({ key: 'tip' })` both give `'tip@'`, and the reads segment matches, so the byValue map returns the first entry: the head drawn is `tip@`'s shape, cached in `entry.shapes`/`entry.draws` by role, instead of `tip`'s. Marker keys are consumer-chosen strings and nothing forbids `@` (or `|`, the join separator, which can likewise shift fields into a collision). Should encode the ref unambiguously (e.g. `JSON.stringify`, or a tag distinguishing the string and object forms).
- evidence: read (refKey and key construction; `markerKeyOf` in packages/stroke/src/markerInset.ts:23 accepts any string)
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
